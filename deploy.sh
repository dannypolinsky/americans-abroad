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
    echo "Usage: ./deploy.sh [frontend|backend|both]"
    echo ""
    echo "  frontend  - Build and deploy frontend to Ionos via SSH"
    echo "  backend   - Push to GitHub (triggers Render auto-deploy)"
    echo "  both      - Deploy both frontend and backend"
    exit 1
}

deploy_backend() {
    echo -e "${YELLOW}Deploying backend to Render...${NC}"

    # Check for uncommitted changes
    if [[ -n $(git status -s) ]]; then
        echo -e "${RED}Error: You have uncommitted changes. Please commit first.${NC}"
        git status -s
        exit 1
    fi

    git push origin main
    echo -e "${GREEN}Backend deployed! Render will auto-deploy from GitHub.${NC}"
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
    if command -v sshpass &> /dev/null; then
        sshpass -p "$IONOS_SSH_PASS" rsync -avz --delete --exclude='logs' \
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
    backend)
        deploy_backend
        ;;
    both)
        deploy_backend
        deploy_frontend
        ;;
    *)
        usage
        ;;
esac
