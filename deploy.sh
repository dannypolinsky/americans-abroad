#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: ./deploy.sh [both|nas|frontend|push]"
    echo ""
    echo "  both      - Deploy backend to NAS + frontend to Ionos (default)"
    echo "  nas       - Sync backend to QNAP NAS and restart Docker container"
    echo "  frontend  - Build and deploy frontend to Ionos via SSH"
    echo "  push      - Push commits to GitHub (source control only; deploys nothing)"
    exit 1
}

# Source control only. This deploys NOTHING: the backend runs on the NAS (./deploy.sh nas)
# and the frontend on Ionos (./deploy.sh frontend). Nothing auto-deploys from GitHub.
# (This used to be `backend`, which pushed to GitHub for a Render service that was retired
# when the backend moved to the NAS — the name made a push look like a backend deploy.)
push_to_github() {
    echo -e "${YELLOW}Pushing commits to GitHub...${NC}"

    # Check for uncommitted changes
    if [[ -n $(git status -s) ]]; then
        echo -e "${RED}Error: You have uncommitted changes. Please commit first.${NC}"
        git status -s
        exit 1
    fi

    git push origin main
    echo -e "${GREEN}Pushed to GitHub. Nothing was deployed — use 'nas' and/or 'frontend' for that.${NC}"
}

deploy_nas() {
    echo -e "${YELLOW}Deploying backend to QNAP NAS...${NC}"

    if [ -z "$QNAP_SSH_HOST" ] || [ -z "$QNAP_SSH_USER" ] || [ -z "$QNAP_REMOTE_PATH" ]; then
        echo -e "${RED}Error: Missing QNAP credentials in .env${NC}"
        echo "  Required: QNAP_SSH_HOST, QNAP_SSH_USER, QNAP_REMOTE_PATH"
        echo "  Optional: QNAP_SSH_PASS (if not using SSH key auth)"
        exit 1
    fi

    echo "Syncing backend files to NAS..."

    # Build rsync command (exclude node_modules — NAS will install them).
    #
    # An array, not a string: as a string, unquoted expansion word-splits but leaves any
    # quotes as literal characters, so rsync gets a pattern that matches nothing.
    #
    # /data/cache/ is the Docker volume holding rosterDrift.json, transferLog.json and the
    # two game caches — the ONLY durable record of an applied transfer (players.json is
    # baked into the image and reverts on every rebuild; see matchTrackerFD.js:77-80).
    # Syncing into it would overwrite live drift state with whatever stale copy this laptop
    # has. Harmless only while the local cache dir is empty; run the backend locally once
    # and it is not. Anchored with a leading / because this rsync's transfer root is
    # backend/, NOT the repo root — so the pattern is /data/cache/, not backend/data/cache.
    # (That path difference is why .env's NAS_EXCLUDES, written for the global skill's
    # repo-root transfer, is deliberately not reused here.)
    RSYNC_EXCLUDES=(--exclude=node_modules --exclude=.env --exclude=/data/cache/)
    SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=5"

    # If local NAS IP isn't reachable, fall back to Tailscale IP
    TAILSCALE_NAS_IP="100.84.253.80"
    if ! ssh $SSH_OPTS -i "$HOME/.ssh/nas_deploy" "${QNAP_SSH_USER}@${QNAP_SSH_HOST}" true 2>/dev/null; then
        echo -e "${YELLOW}Local NAS unreachable — trying Tailscale (${TAILSCALE_NAS_IP})...${NC}"
        echo -e "${YELLOW}Make sure Tailscale is connected and NordVPN is off.${NC}"
        QNAP_SSH_HOST="$TAILSCALE_NAS_IP"
    fi

    NAS_SSH_KEY="$HOME/.ssh/nas_deploy"
    if [ -f "$NAS_SSH_KEY" ]; then
        rsync -avz "${RSYNC_EXCLUDES[@]}" \
            -e "ssh $SSH_OPTS -i $NAS_SSH_KEY" \
            backend/ "${QNAP_SSH_USER}@${QNAP_SSH_HOST}:${QNAP_REMOTE_PATH}/"
    elif command -v sshpass &> /dev/null && [ -n "$QNAP_SSH_PASS" ]; then
        SSHPASS="$QNAP_SSH_PASS" sshpass -e rsync -avz "${RSYNC_EXCLUDES[@]}" \
            -e "ssh $SSH_OPTS" \
            backend/ "${QNAP_SSH_USER}@${QNAP_SSH_HOST}:${QNAP_REMOTE_PATH}/"
    elif [ -n "$QNAP_SSH_PASS" ]; then
        expect << EOF
set timeout 120
spawn rsync -avz ${RSYNC_EXCLUDES[@]} -e "ssh $SSH_OPTS" backend/ ${QNAP_SSH_USER}@${QNAP_SSH_HOST}:${QNAP_REMOTE_PATH}/
expect {
    "password:" { send "${QNAP_SSH_PASS}\r"; exp_continue }
    "Password:" { send "${QNAP_SSH_PASS}\r"; exp_continue }
    eof
}
EOF
    else
        # SSH key auth (no password needed)
        rsync -avz "${RSYNC_EXCLUDES[@]}" \
            -e "ssh $SSH_OPTS" \
            backend/ "${QNAP_SSH_USER}@${QNAP_SSH_HOST}:${QNAP_REMOTE_PATH}/"
    fi

    echo "Restarting Docker container on NAS..."

    DOCKER="/share/CACHEDEV1_DATA/.qpkg/container-station/bin/docker"
    SSH_CMD="cd ${QNAP_REMOTE_PATH} && ${DOCKER} compose down && ${DOCKER} compose up -d --build"

    if [ -f "$NAS_SSH_KEY" ]; then
        ssh $SSH_OPTS -i "$NAS_SSH_KEY" "${QNAP_SSH_USER}@${QNAP_SSH_HOST}" "$SSH_CMD"
    elif [ -n "$QNAP_SSH_PASS" ] && command -v sshpass &> /dev/null; then
        SSHPASS="$QNAP_SSH_PASS" sshpass -e ssh $SSH_OPTS \
            "${QNAP_SSH_USER}@${QNAP_SSH_HOST}" "$SSH_CMD"
    elif [ -n "$QNAP_SSH_PASS" ]; then
        expect << EOF
set timeout 300
spawn ssh $SSH_OPTS ${QNAP_SSH_USER}@${QNAP_SSH_HOST} "$SSH_CMD"
expect {
    "password:" { send "${QNAP_SSH_PASS}\r"; exp_continue }
    "Password:" { send "${QNAP_SSH_PASS}\r"; exp_continue }
    eof
}
EOF
    else
        ssh $SSH_OPTS "${QNAP_SSH_USER}@${QNAP_SSH_HOST}" "$SSH_CMD"
    fi

    echo -e "${GREEN}Backend deployed to NAS!${NC}"
    echo ""
    echo "Test it: curl http://${QNAP_SSH_HOST}:3001/api/health"
}

deploy_frontend() {
    echo -e "${YELLOW}Deploying frontend to Ionos...${NC}"

    # Check required env vars
    if [ -z "$IONOS_SSH_HOST" ] || [ -z "$IONOS_SSH_USER" ] || [ -z "$IONOS_SSH_PASS" ]; then
        echo -e "${RED}Error: Missing Ionos SSH credentials in .env${NC}"
        exit 1
    fi

    # Build frontend
    echo "Building frontend..."
    npm run build

    # Deploy using rsync over SSH with expect (built into macOS)
    echo "Uploading to Ionos..."

    # Use sshpass if available, otherwise fall back to expect
    IONOS_SSH_KEY="$HOME/.ssh/ionos_deploy"
    if [ -f "$IONOS_SSH_KEY" ]; then
        rsync -avz --delete --exclude='logs' \
            -e "ssh -i $IONOS_SSH_KEY -o StrictHostKeyChecking=no" \
            dist/ "${IONOS_SSH_USER}@${IONOS_SSH_HOST}:${IONOS_REMOTE_PATH}"
    elif command -v sshpass &> /dev/null; then
        SSHPASS="$IONOS_SSH_PASS" sshpass -e rsync -avz --delete --exclude='logs' \
            -e "ssh -o StrictHostKeyChecking=no" \
            dist/ "${IONOS_SSH_USER}@${IONOS_SSH_HOST}:${IONOS_REMOTE_PATH}"
    else
        # Use expect (built into macOS) as fallback
        expect << EOF
set timeout 300
spawn rsync -avz --delete --exclude=logs -e "ssh -o StrictHostKeyChecking=no" dist/ ${IONOS_SSH_USER}@${IONOS_SSH_HOST}:${IONOS_REMOTE_PATH}
expect {
    "password:" {
        send "${IONOS_SSH_PASS}\r"
        exp_continue
    }
    "Password:" {
        send "${IONOS_SSH_PASS}\r"
        exp_continue
    }
    eof
}
EOF
    fi

    echo -e "${GREEN}Frontend deployed to Ionos!${NC}"
}

# Main
case "${1:-both}" in
    frontend)
        deploy_frontend
        ;;
    push)
        push_to_github
        ;;
    nas)
        deploy_nas
        ;;
    both)
        # The two things that actually serve the site. Previously this ran a GitHub push
        # plus the frontend, which silently left the backend un-deployed.
        deploy_nas
        deploy_frontend
        ;;
    backend)
        echo -e "${RED}'backend' is gone — it pushed to GitHub for the retired Render service.${NC}"
        echo -e "${YELLOW}Use './deploy.sh nas' to deploy the backend, or './deploy.sh push' to push commits.${NC}"
        exit 1
        ;;
    *)
        usage
        ;;
esac
