const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Keypair } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const NodeWallet = require("@coral-xyz/anchor/dist/cjs/nodewallet").default;


// Minimal IDL - just what we need for initialize
const fs = require("fs");
const IDL = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));

async function main() {
  console.log("🚀 Initializing Beakin Vault Config...\n");
  
  const programId = new PublicKey("2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5");
  const mint = new PublicKey("C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A");
  const adminPubkey = new PublicKey("AJKxLwTAfbDGKBrz2YPRWEJVYTHG56bq1DfUj1BgE1dk");
  
  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config"), mint.toBuffer()],
    programId
  );
  
  const [vaultAuthority, vaultAuthorityBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), mint.toBuffer()],
    programId
  );
  
  const [vaultAta] = PublicKey.findProgramAddressSync(
    [vaultAuthority.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  
  console.log("📋 Details:");
  console.log("Config PDA:", configPda.toString());
  console.log("Vault Authority:", vaultAuthority.toString());
  console.log("Vault Authority Bump:", vaultAuthorityBump);
  console.log("Vault ATA:", vaultAta.toString());
  console.log("\n⚠️  Admin must sign this transaction!");
  console.log("Admin:", adminPubkey.toString());
  
  // Create connection
  const connection = new anchor.web3.Connection(
    "https://api.mainnet-beta.solana.com",
    "confirmed"
  );
  
  // For Ledger, we need to use the Ledger wallet
  // This is a placeholder - actual Ledger signing needs special handling
  console.log("\n🔐 Preparing transaction for Ledger signing...");
  
  // Create a dummy keypair just to build the transaction structure
  const dummyKeypair = Keypair.generate();
  const wallet = new NodeWallet(dummyKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const program = new anchor.Program(IDL, programId, provider);
  
  try {
    // Build the instruction
    const instruction = await program.methods
      .initialize(vaultAuthorityBump)
      .accounts({
        admin: adminPubkey,
        config: configPda,
        mint: mint,
        vaultAuthority: vaultAuthority,
        vaultAta: vaultAta,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
    
    console.log("✅ Instruction built successfully!");
    console.log("\n📝 Instruction data (hex):", instruction.data.toString('hex'));
    console.log("\n🔑 Accounts:");
    instruction.keys.forEach((key, i) => {
      console.log(`  ${i}: ${key.pubkey.toString()} ${key.isSigner ? '(signer)' : ''} ${key.isWritable ? '(writable)' : ''}`);
    });
    
    // Now we need to actually send it with Ledger
    console.log("\n⚠️  Next step: We need to send this transaction with your Ledger.");
    console.log("The @ledgerhq/hw-transport packages would be needed for full Ledger support.");
    console.log("\nAlternatively, we can use 'solana program' CLI commands...");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main();