const { Connection, PublicKey, TransactionInstruction, Transaction, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🤖 Testing Bot Disbursement...\n");
  
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  // Load bot wallet
  const botKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync("C:\\Users\\dsmith\\.config\\solana\\bot-wallet.json")))
  );
  console.log("✅ Bot wallet loaded:", botKeypair.publicKey.toString());
  
  const programId = new PublicKey("2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5");
  const mint = new PublicKey("C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A");
  const configPda = new PublicKey("J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3");
  
  const [vaultAuthority, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    programId
  );
  
  const vaultAta = new PublicKey("AoqRnHTJXp5Mug1KwQemQQJVeoB1XkLtrSvdMVfxmVpr");
  
  // Load IDL to get discriminator
  const idl = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));
  const disburseIx = idl.instructions.find(ix => ix.name === "bot_disburse_rewards");
  const discriminator = Buffer.from(disburseIx.discriminator);
  
  // Test recipients
  const recipients = [
    { address: "9fWJ35LCvDqkj4FRvjuPEwporuCvsYakigq9T2xbFdzS", name: "Team Member 1" },
    { address: "9devjw4MhMr2JYALYJZ3KjyesWBsb5nBbRecc6aGtCx5", name: "Team Member 2" }
  ];
  
  const amountToSend = BigInt(1_000_000_000); // 1 NSTG
  
  for (const recipient of recipients) {
    console.log(`\n📤 Sending 1 NSTG to ${recipient.name}...`);
    console.log(`Address: ${recipient.address}`);
    
    try {
      const recipientPubkey = new PublicKey(recipient.address);
      const recipientAta = await getAssociatedTokenAddress(mint, recipientPubkey);
      
      console.log(`Recipient ATA: ${recipientAta.toString()}`);
      
      // Check if ATA exists
      const ataInfo = await connection.getAccountInfo(recipientAta);
      
      if (!ataInfo) {
        console.log("⚠️  Creating token account for recipient...");
        
        const createAtaIx = createAssociatedTokenAccountInstruction(
          botKeypair.publicKey,
          recipientAta,
          recipientPubkey,
          mint
        );
        
        const tx = new Transaction().add(createAtaIx);
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = botKeypair.publicKey;
        tx.sign(botKeypair);
        
        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig);
        console.log("✅ Token account created");
      } else {
        console.log("✅ Token account exists");
      }
      
      // Build disburse instruction
      const amountBytes = Buffer.alloc(8);
      amountBytes.writeBigUInt64LE(amountToSend);
      const data = Buffer.concat([discriminator, amountBytes]);
      
      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: botKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: configPda, isSigner: false, isWritable: true },
          { pubkey: vaultAuthority, isSigner: false, isWritable: false },
          { pubkey: vaultAta, isSigner: false, isWritable: true },
          { pubkey: recipientAta, isSigner: false, isWritable: true },
          { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: programId,
        data: data,
      });
      
      const tx = new Transaction().add(instruction);
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = botKeypair.publicKey;
      tx.sign(botKeypair);
      
      console.log("📤 Sending transaction...");
      const txid = await connection.sendRawTransaction(tx.serialize());
      console.log("⏳ Confirming...");
      await connection.confirmTransaction(txid);
      
      console.log("✅ SUCCESS!");
      console.log(`Transaction: https://solscan.io/tx/${txid}`);
      console.log(`✅ Sent 1 NSTG to ${recipient.name}\n`);
      
    } catch (err) {
      console.error(`❌ Error for ${recipient.name}:`, err.message);
      if (err.logs) console.error("Logs:", err.logs);
    }
  }
  
  console.log("\n🎉 Test complete!");
  console.log("Daily disbursed should now be 2 NSTG (2,000,000,000 base units)");
}

main().catch(console.error);