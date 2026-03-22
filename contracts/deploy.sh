#!/bin/bash
# GuessNFT CommitReveal — deploy with sncast
# Usage: ./deploy.sh
#
# Uses snfoundry.toml for account + RPC config.
# Steps: build → declare → deploy (no constructor args)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${BLUE}    CommitReveal Contract Deploy (sncast)       ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"

echo ""
echo -e "${BLUE}Step 1: Building...${NC}"
scarb build
echo -e "${GREEN}✓ Built${NC}"

echo ""
echo -e "${BLUE}Step 2: Declaring...${NC}"
DECLARE_OUTPUT=$(sncast declare --contract-name CommitReveal 2>&1)
echo "$DECLARE_OUTPUT"

CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep "class_hash:" | awk '{print $2}')
if [ -z "$CLASS_HASH" ]; then
    # Already declared — extract from error
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | head -1)
    echo -e "${YELLOW}⚠ Already declared: $CLASS_HASH${NC}"
else
    echo -e "${GREEN}✓ Declared: $CLASS_HASH${NC}"
fi

echo ""
echo -e "${BLUE}Step 3: Deploying (no constructor args)...${NC}"
DEPLOY_OUTPUT=$(sncast deploy --class-hash "$CLASS_HASH" 2>&1)
echo "$DEPLOY_OUTPUT"

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "contract_address:" | awk '{print $2}')
if [ -z "$CONTRACT_ADDRESS" ]; then
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP '0x[0-9a-fA-F]+' | tail -1)
fi

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "Class hash:       ${GREEN}$CLASS_HASH${NC}"
echo -e "Contract address: ${GREEN}$CONTRACT_ADDRESS${NC}"
echo ""
echo -e "${YELLOW}Next: paste into src/services/starknet/config.ts${NC}"
echo "  export const GAME_CONTRACT = '$CONTRACT_ADDRESS';"
