const express = require('express');
const cors = require('cors');
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// SOLANA RPC CONNECTION - UPDATED FOR HELIUS
// ============================================================
// Use environment variable for RPC URL, fallback to public endpoint
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

console.log('🌐 Solana RPC:', SOLANA_RPC_URL.includes('helius') ? 'Helius (Premium)' : 'Public (Rate Limited)');
// ============================================================

// Load bot wallet from environment variable OR file
let botWallet;
if (process.env.BOT_WALLET_KEYPAIR) {
    // Railway/Production - from environment variable
    const keypairArray = JSON.parse(process.env.BOT_WALLET_KEYPAIR);
    botWallet = Keypair.fromSecretKey(new Uint8Array(keypairArray));
    console.log('✅ Bot wallet loaded from environment variable');
} else {
    // Local development - from file
    const BOT_WALLET_PATH = 'C:/Users/dsmith/.config/solana/bot-wallet.json';
    botWallet = Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(BOT_WALLET_PATH)))
    );
    console.log('✅ Bot wallet loaded from file');
}

console.log('🤖 Bot wallet:', botWallet.publicKey.toBase58());

// Vault addresses (mainnet)
const PROGRAM_ID = new PublicKey('2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5');
const NSTG_MINT = new PublicKey('C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A');
const CONFIG_PDA = new PublicKey('J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3');
const VAULT_AUTHORITY = new PublicKey('D4FXGmzMMdybFmmG5ewABQgqfpm5qBitW2rZtqx9HvxF');
const VAULT_ATA = new PublicKey('AoqRnHTJXp5Mug1KwQemQQJVeoB1XkLtrSvdMVfxmVpr');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

console.log('🏦 NSTG Disbursement Server Started');
console.log('🎯 Listening on port 3000');
console.log('🤖 Bot wallet:', botWallet.publicKey.toBase58());
console.log('🏦 Vault ATA:', VAULT_ATA.toBase58());
console.log('⚙️  Config PDA:', CONFIG_PDA.toBase58());
console.log('');
console.log('💡 Test with: POST http://localhost:3000/api/disburse-nstg');

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        botWallet: botWallet.publicKey.toBase58(),
        rpcEndpoint: SOLANA_RPC_URL.includes('helius') ? 'Helius' : 'Public',
        timestamp: new Date().toISOString()
    });
});

// NSTG disbursement endpoint
app.post('/api/disburse-nstg', async (req, res) => {
    try {
        const { recipientWallet, nstgAmount, userId, goldenEggs } = req.body;
        
        console.log('\n💰 NSTG Disbursement Request:');
        console.log('User ID:', userId);
        console.log('Recipient:', recipientWallet);
        console.log('Amount:', nstgAmount, 'NSTG');
        console.log('Golden Eggs:', goldenEggs);
        
        // Validate inputs
        if (!recipientWallet || !nstgAmount) {
            return res.status(400).json({ 
                success: false, 
                error: 'Missing recipientWallet or nstgAmount' 
            });
        }
        
        const recipientPubkey = new PublicKey(recipientWallet);
        
        // Convert NSTG to smallest units (9 decimals)
        const amountInSmallestUnits = Math.floor(nstgAmount * (10 ** 9));
        
        console.log('Token amount (with decimals):', amountInSmallestUnits);
        
        // Get recipient's ATA for NSTG
        const recipientATA = await getAssociatedTokenAddress(
            NSTG_MINT,
            recipientPubkey,
            false,
            TOKEN_PROGRAM
        );
        
        console.log('Recipient ATA:', recipientATA.toBase58());
        
        // Check if recipient ATA exists
        const recipientATAInfo = await connection.getAccountInfo(recipientATA);
        
        const transaction = new Transaction();
        
        // Create ATA if it doesn't exist (bot pays for rent)
        if (!recipientATAInfo) {
            console.log('⚠️  Recipient ATA does not exist, creating it...');
            const createATAIx = createAssociatedTokenAccountInstruction(
                botWallet.publicKey,  // Payer (bot)
                recipientATA,         // ATA to create
                recipientPubkey,      // Owner
                NSTG_MINT,           // Mint
                TOKEN_PROGRAM
            );
            transaction.add(createATAIx);
        }
        
        // Construct bot_disburse_rewards instruction
        const discriminator = Buffer.from([210, 111, 94, 103, 248, 212, 11, 70]);
        const amountBuffer = Buffer.alloc(8);
        amountBuffer.writeBigUInt64LE(BigInt(amountInSmallestUnits));
        
        const instructionData = Buffer.concat([discriminator, amountBuffer]);
        
        const keys = [
            { pubkey: botWallet.publicKey, isSigner: true, isWritable: true },
            { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },
            { pubkey: VAULT_AUTHORITY, isSigner: false, isWritable: false },
            { pubkey: VAULT_ATA, isSigner: false, isWritable: true },
            { pubkey: recipientATA, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false }
        ];
        
        const disburseInstruction = {
            programId: PROGRAM_ID,
            keys: keys,
            data: instructionData
        };
        
        transaction.add(disburseInstruction);
        console.log('✅ Added disburse instruction');
        
        // Sign and send transaction
        transaction.feePayer = botWallet.publicKey;
        transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        
        transaction.sign(botWallet);
        console.log('✅ Transaction signed');
        
        const signature = await connection.sendRawTransaction(transaction.serialize());
        console.log('📤 Transaction sent:', signature);
        
        // Wait for confirmation
        await connection.confirmTransaction(signature, 'confirmed');
        console.log('✅ Transaction confirmed!');
        console.log(`💸 Sent ${nstgAmount} NSTG to ${recipientWallet}`);
        
        res.json({
            success: true,
            transactionHash: signature,
            explorerUrl: `https://solscan.io/tx/${signature}`,
            nstgAmount: nstgAmount,
            recipientWallet: recipientWallet
        });
        
    } catch (error) {
        console.error('❌ Error disbursing NSTG:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
});
