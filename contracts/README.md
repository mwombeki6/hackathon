# BlockEngage Smart Contracts

A comprehensive blockchain-powered task management platform with gamification features for office environments, deployed on AlphachainLive network.

## Overview

BlockEngage is a decentralized task management system that combines productivity tracking with gamification elements including token rewards, leagues, lotteries, and head-to-head challenges.

## Smart Contracts

### 1. BlockEngageToken (BET)
- **Purpose**: ERC20 token for rewards and platform economy
- **Features**: 
  - Minting/burning capabilities for authorized contracts
  - User statistics tracking (earned/spent tokens)
  - Batch token operations
  - Pausable functionality

### 2. TaskManager
- **Purpose**: Core task creation, completion, and reward system
- **Features**:
  - Task lifecycle management (Created → InProgress → Completed → Verified)
  - Priority-based reward calculation
  - Daily streak tracking with bonuses
  - Task verification system
  - Comprehensive user statistics

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
