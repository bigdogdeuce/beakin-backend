const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionInstruction,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL
} = require('@solana/web3.js');
const { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} = require('@solana/spl-token');

const app = express();
app.use(cors());
app.use(express.json());

// ===== CONFIGURATION =====
const PROGRAM_ID = new PublicKey('2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5');
const NSTG_MINT = new PublicKey('C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A');
const CONFIG_PDA = new PublicKey('J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3');
const VAULT_AUTHORITY = new PublicKey('D4FXGmzMMdybFmmG5ewABQgqfpm5qBitW2rZtqx9HvxF');
const VAULT_ATA = new PublicKey('AoqRnHTJXp5Mug1KwQemQQJVeoB1XkLtrSvdMVfxmVpr');
const BOT_WALLET_PATH = 'C:/Users/dsmith/.config/solana/bot-wallet.json';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

// NSTG has 9 decimals
const NSTG_DECIMALS = 9;

// Load bot wallet
let botWallet;
try {
  const secretKey = JSON.parse(fs.readFileSync(BOT_WALLET_PATH, 'utf-8'));
  botWallet = Keypair.fromSecretKey(new Uint8Array(secretKey));
  console.log('✅ Bot wallet loaded:', botWallet.publicKey.toBase58());
} catch (error) {
  console.error('❌ Failed to load bot wallet:', error);
  process.exit(1);
}

// Create Solana connection
const connection = new Connection(RPC_URL, 'confirmed');

// ===== DISBURSE INSTRUCTION DISCRIMINATOR =====
// From beakin_vault.json - bot_disburse_rewards instruction
const DISBURSE_DISCRIMINATOR = Buffer.from([210, 111, 94, 103, 248, 212, 11, 70]);

// ===== API ENDPOINT =====
app.post('/api/disburse-nstg', async (req, res) => {
  try {
    const { recipientWallet, nstgAmount, userId, goldenEggs } = req.body;
    
    console.log('\n🏦 NSTG Disbursement Request:');
    console.log('User ID:', userId);
    console.log('Recipient:', recipientWallet);
    console.log('Amount:', nstgAmount, 'NSTG');
    console.log('Golden Eggs:', goldenEggs);
    
    // Validate inputs
    if (!recipientWallet || !nstgAmount || !userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    // Convert recipient wallet to PublicKey
    let recipientPubkey;
    try {
      recipientPubkey = new PublicKey(recipientWallet);
    } catch (error) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid wallet address' 
      });
    }
    
    // Calculate token amount with decimals (9 decimals for NSTG)
    const tokenAmount = Math.floor(nstgAmount * Math.pow(10, NSTG_DECIMALS));
    console.log('Token amount (with decimals):', tokenAmount);
    
    // Get recipient's associated token account
    const recipientATA = await getAssociatedTokenAddress(
      NSTG_MINT,
      recipientPubkey
    );
    console.log('Recipient ATA:', recipientATA.toBase58());
    
    // Check if recipient ATA exists
    const recipientATAInfo = await connection.getAccountInfo(recipientATA);
    const needsATACreation = recipientATAInfo === null;
    
    if (needsATACreation) {
      console.log('⚠️ Recipient ATA does not exist - will create it');
    }
    
    // Create transaction
    const transaction = new Transaction();
    
    // Add create ATA instruction if needed
    if (needsATACreation) {
      const createATAIx = createAssociatedTokenAccountInstruction(
        botWallet.publicKey,  // payer
        recipientATA,         // ata
        recipientPubkey,      // owner
        NSTG_MINT            // mint
      );
      transaction.add(createATAIx);
      console.log('✅ Added create ATA instruction');
    }
    
    // Create disburse instruction
    // Instruction data: [discriminator (8 bytes)][amount (8 bytes, little-endian)]
    const instructionData = Buffer.alloc(16);
    DISBURSE_DISCRIMINATOR.copy(instructionData, 0);
    instructionData.writeBigUInt64LE(BigInt(tokenAmount), 8);
    
    const disburseIx = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: botWallet.publicKey, isSigner: true, isWritable: true },  // bot
        { pubkey: CONFIG_PDA, isSigner: false, isWritable: true },          // config
        { pubkey: VAULT_AUTHORITY, isSigner: false, isWritable: false },    // vault_authority
        { pubkey: VAULT_ATA, isSigner: false, isWritable: true },           // vault_ata
        { pubkey: recipientATA, isSigner: false, isWritable: true },        // recipient_ata
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }    // token_program
      ],
      data: instructionData
    });
    transaction.add(disburseIx);
    console.log('✅ Added disburse instruction');
    
    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = botWallet.publicKey;
    
    // Sign transaction
    transaction.sign(botWallet);
    console.log('✅ Transaction signed');
    
    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    console.log('📤 Transaction sent:', signature);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight
    }, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('❌ Transaction failed:', confirmation.value.err);
      return res.status(500).json({
        success: false,
        error: 'Transaction failed',
        signature,
        details: confirmation.value.err
      });
    }
    
    console.log('✅ Transaction confirmed!');
    console.log(`🎉 Sent ${nstgAmount} NSTG to ${recipientWallet}`);
    
    // Return success
    res.json({
      success: true,
      transactionHash: signature,
      nstgAmount: nstgAmount,
      recipient: recipientWallet,
      explorerUrl: `https://solscan.io/tx/${signature}`
    });
    
  } catch (error) {
    console.error('❌ Error processing disbursement:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.toString()
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    botWallet: botWallet.publicKey.toBase58(),
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n🚀 NSTG Disbursement Server Started');
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🤖 Bot wallet: ${botWallet.publicKey.toBase58()}`);
  console.log(`🏦 Vault ATA: ${VAULT_ATA.toBase58()}`);
  console.log(`⚙️  Config PDA: ${CONFIG_PDA.toBase58()}`);
  console.log(`\n💡 Test with: POST http://localhost:${PORT}/api/disburse-nstg`);
});
