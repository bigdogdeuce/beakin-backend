const anchor = require("@coral-xyz/anchor");
const { PublicKey, Connection, Keypair } = require("@solana/web3.js");
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
  
  // Load program
  const idl = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));
  const programId = new PublicKey("2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5");
  const wallet = new anchor.Wallet(botKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const program = new anchor.Program(idl, programId, provider);
  
  const mint = new PublicKey("C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A");
  const configPda = new PublicKey("J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3");
  
  const [vaultAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    programId
  );
  
  const vaultAta = new PublicKey("AirSLqffu5X3WWPJfFc6TEHLQ6NeZCZVq23zrWsdDMZd");
  
  // Test recipients
  const recipients = [
    { address: "9fWJ35LCvDqkj4FRvjuPEwporuCvsYakigq9T2xbFdzS", name: "Team Member 1" },
    { address: "9devjw4MhMr2JYALYJZ3KjyesWBsb5nBbRecc6aGtCx5", name: "Team Member 2" }
  ];
  
  const amountToSend = 1_000_000_000; // 1 NSTG (with 9 decimals)
  
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
        console.log("⚠️  Recipient doesn't have NSTG token account yet. Creating it...");
        
        // Create ATA instruction
        const createAtaIx = createAssociatedTokenAccountInstruction(
          botKeypair.publicKey, // payer
          recipientAta,         // ata
          recipientPubkey,      // owner
          mint                  // mint
        );
        
        // Send create ATA transaction
        const tx = new anchor.web3.Transaction().add(createAtaIx);
        const sig = await provider.sendAndConfirm(tx);
        console.log("✅ Token account created:", sig);
      } else {
        console.log("✅ Token account already exists");
      }
      
      // Now disburse
      console.log(`\n🎁 Disbursing 1 NSTG...`);
      
      const tx = await program.methods
        .botDisburseRewards(new anchor.BN(amountToSend))
        .accounts({
          bot: botKeypair.publicKey,
          config: configPda,
          vaultAuthority: vaultAuthority,
          vaultAta: vaultAta,
          recipientAta: recipientAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      console.log("✅ SUCCESS!");
      console.log(`Transaction: https://solscan.io/tx/${tx}`);
      console.log(`Sent 1 NSTG to ${recipient.name}`);
      
    } catch (err) {
      console.error(`❌ Error sending to ${recipient.name}:`, err.message);
    }
  }
  
  console.log("\n🎉 Test complete!");
  console.log("\nVerify the Config account daily counter:");
  console.log("solana account J1YymXsBcc5fMstuzqKrzcVMW8RwcuZs7hVkwdV6ARb3 --url https://api.mainnet-beta.solana.com");
}

main().catch(console.error);
