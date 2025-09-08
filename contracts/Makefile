# BlockEngage Smart Contracts Makefile

# Load environment variables
include .env
export

# Default target
.PHONY: help
help:
	@echo "BlockEngage Smart Contracts"
	@echo "Available commands:"
	@echo "  build          - Compile all contracts"
	@echo "  test           - Run all tests"
	@echo "  test-verbose   - Run tests with verbose output"
	@echo "  deploy-local   - Deploy to local network"
	@echo "  deploy-alpha   - Deploy to AlphaChain network"
	@echo "  verify         - Verify contracts on explorer"
	@echo "  clean          - Clean build artifacts"
	@echo "  install        - Install dependencies"

# Build contracts
.PHONY: build
build:
	forge build

# Run tests
.PHONY: test
test:
	forge test

# Run tests with verbose output
.PHONY: test-verbose
test-verbose:
	forge test -vvv

# Deploy to local network
.PHONY: deploy-local
deploy-local:
	forge script script/DeployBlockEngage.s.sol:DeployBlockEngage --rpc-url $(LOCALHOST_RPC_URL) --broadcast

# Deploy to AlphaChain network
.PHONY: deploy-alpha
deploy-alpha:
	@mkdir -p deployments
	forge script script/DeployBlockEngage.s.sol:DeployBlockEngage --rpc-url $(ALPHACHAIN_RPC_URL) --broadcast --verify

# Verify contracts on explorer
.PHONY: verify
verify:
	forge verify-contract $(BLOCKENGAGE_TOKEN_ADDRESS) src/BlockEngageToken.sol:BlockEngageToken --chain alphachain
	forge verify-contract $(TASK_MANAGER_ADDRESS) src/TaskManager.sol:TaskManager --chain alphachain --constructor-args $(shell cast abi-encode "constructor(address)" $(BLOCKENGAGE_TOKEN_ADDRESS))

# Clean build artifacts
.PHONY: clean
clean:
	forge clean

# Install dependencies
.PHONY: install
install:
	forge install

# Run specific test file
.PHONY: test-token
test-token:
	forge test --match-contract BlockEngageTokenTest -vv

.PHONY: test-task
test-task:
	forge test --match-contract TaskManagerTest -vv

.PHONY: test-h2h
test-h2h:
	forge test --match-contract HeadToHeadManagerTest -vv

# Gas report
.PHONY: gas-report
gas-report:
	forge test --gas-report

# Coverage report
.PHONY: coverage
coverage:
	forge coverage
