# BlockEngage - Blockchain Task Management Platform

A unified blockchain-powered task management platform with gamification features for office environments, deployed on AlphachainLive network

## Features

- **Task Management**: Create, assign, and track tasks with blockchain immutability
- **Token Rewards**: Earn tokens for task completion and peer recognition
- **Daily Streaks**: Maintain engagement with consecutive daily activities
- **FPL-Style Leagues**: Compete in leagues with weekly scoring and rankings
- **Head-to-Head Competitions**: Direct challenges between users
- **Mystery Lottery**: Win perks through automated lottery system
- **Employee Voting**: Monthly polls for employee recognition

## Tech Stack

- **Blockchain**: AlphachainLive Network
- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: React Native
- **Smart Contracts**: Solidity
- **Real-time**: Socket.io

## Project Structure

```
blockengage/
├── contracts/          # Smart contracts for AlphachainLive
├── server/            # Node.js backend API
├── mobile/            # React Native mobile app
├── database/          # PostgreSQL schemas and migrations
└── docs/              # Documentation
```

## Quick Start

1. Install dependencies: `npm install`
2. Set up database: `npm run db:migrate`
3. Deploy contracts: `npm run deploy:contracts`
4. Start backend: `npm run dev`
5. Run mobile app: `npm run build:mobile`

## Environment Variables

Create `.env` file with:
- `DATABASE_URL`: PostgreSQL connection string
- `ALPHACHAIN_RPC_URL`: AlphachainLive RPC endpoint
- `PRIVATE_KEY`: Deployment private key
- `JWT_SECRET`: JWT signing secret
