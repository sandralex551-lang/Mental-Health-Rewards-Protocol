# 🧠 Mental Health Rewards Protocol

Welcome to a revolutionary Web3 platform that incentivizes consistent mental health practices! This project addresses the real-world problem of mental health challenges by rewarding users with tokens for maintaining streaks in activities like meditation, journaling, exercise, or therapy sessions. Using the Stacks blockchain and Clarity smart contracts, users build habits, earn fungible tokens (MHT - Mental Health Tokens), and unlock NFT badges. Tokens can be staked for bonuses, donated to charities, or traded, fostering a supportive community while promoting well-being.

## ✨ Features

🔄 Track daily mental health activities with streak multipliers  
🏆 Earn MHT tokens based on streak length (e.g., 7-day meditation streak = bonus rewards)  
🎖 Mint NFT badges for milestones (e.g., 30-day streak)  
📈 Stake tokens for passive rewards and governance voting  
🤝 Donate tokens to verified mental health organizations  
🔒 Secure user profiles with privacy-focused ownership  
📊 Community dashboard for progress sharing (off-chain integration)  
🚫 Anti-cheat mechanisms via oracle-verified proofs (e.g., app integrations)  
💰 Token economy with burning and minting for sustainability  

## 🛠 How It Works

This project leverages 8 Clarity smart contracts to create a decentralized, tamper-proof system. Users interact via a dApp interface, logging activities that are verified and rewarded on-chain. Here's the breakdown:

### Smart Contracts Overview

1. **UserProfile.clar**: Manages user registration, stores profiles (e.g., username, preferences), and handles ownership proofs. Users call `register-user` to create an account.

2. **ActivityLogger.clar**: Logs daily activities (e.g., meditation sessions). Users submit hashes or proofs via `log-activity`, which timestamps entries immutably.

3. **StreakManager.clar**: Calculates and updates streaks based on logged activities. Includes functions like `update-streak` to check consecutive days and apply multipliers (e.g., x2 rewards after 7 days).

4. **MentalHealthToken.clar**: A SIP-010 compliant fungible token contract for MHT. Handles minting, burning, and transfers. Rewards are minted via `mint-rewards` based on streak data.

5. **RewardClaimer.clar**: Allows users to claim tokens after verifying streaks. Calls `claim-rewards` to distribute MHT, with cooldowns to prevent abuse.

6. **NFTBadge.clar**: Mints non-fungible tokens (SIP-009 compliant) for achievements. Users call `mint-badge` when milestones are hit, creating unique collectibles.

7. **StakingVault.clar**: Enables staking MHT for additional yields. Functions like `stake-tokens` lock assets and `unstake` with rewards calculated over time.

8. **DonationPool.clar**: Pools donated tokens and distributes to whitelisted charities. Includes `donate-tokens` and governance-approved `disburse-funds`.

### For Users (Habit Builders)

- Register your profile using `UserProfile.clar`.
- Log daily activities (e.g., a 10-minute meditation) via `ActivityLogger.clar` – provide a simple hash or integrate with apps for auto-proof.
- The `StreakManager.clar` automatically updates your streak.
- Claim MHT rewards through `RewardClaimer.clar` – longer streaks mean bigger payouts!
- Unlock NFT badges with `NFTBadge.clar` for bragging rights.
- Stake your tokens in `StakingVault.clar` for passive income, or donate via `DonationPool.clar` to support causes.

Boom! You're building better habits while earning real value.

### For Verifiers/Community

- Query user streaks or badges using read-only functions like `get-streak-details` in `StreakManager.clar`.
- Participate in governance by staking tokens to vote on updates (e.g., new activity types).
- Charities can be added via community proposals, ensuring transparency.

### Integration Notes

- Activities can be self-reported or verified via oracles (e.g., integrating with fitness apps for proof-of-exercise).
- The token economy is balanced: 50% of rewards from streaks, 30% from staking yields, 20% burned on donations to prevent inflation.
- Built with Clarity for security and efficiency on Stacks – no gas wars!

Get started by deploying these contracts on the Stacks testnet and building your dApp frontend. Let's make mental health rewarding! 🌟