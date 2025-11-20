const { Connection, PublicKey, TransactionInstruction, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🚀 Building and Sending Initialize Transaction...\n");
  
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  
  const programId = new PublicKey("2zHmxdM1weXuEkL7q7R9romZsPNdTLPAHGEPjBFA4da5");
  const mint = new PublicKey("C2dp9NjivNUNpSkrFUejnSsNS6ydgMmDdo5oMmuSev9A");
  const admin = new PublicKey("AJKxLwTAfbDGKBrz2YPRWEJVYTHG56bq1DfUj1BgE1dk");
  
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
  
  console.log("📋 Accounts:");
  console.log("Config PDA:", configPda.toString());
  console.log("Vault Authority Bump:", vaultAuthorityBump);
  
  // Build instruction data
  const idl = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));
  const initializeIx = idl.instructions.find(ix => ix.name === "initialize");
  const discriminator = Buffer.from(initializeIx.discriminator);
  const data = Buffer.concat([discriminator, Buffer.from([vaultAuthorityBump])]);
  
  // Create instruction
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: vaultAuthority, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: programId,
    data: data,
  });
  
  // Create transaction
  const transaction = new Transaction();
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = admin;
  transaction.add(instruction);
  
  // Serialize for signing
  const serialized = transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
const base64Tx = serialized.toString('base64');
  
  console.log("\n✅ Transaction built successfully!");
  console.log("\n📝 Transaction (base64):");
  console.log(base64Tx);
  
  // Save to file for Ledger signing
  fs.writeFileSync("init-tx.txt", base64Tx);
  console.log("\n💾 Transaction saved to: init-tx.txt");
  
  console.log("\n🔐 Next steps:");
  console.log("1. Make sure Solana app is open on your Ledger");
  console.log("2. Run this command to sign and send:");
  console.log("\n   solana sign-and-send-transaction init-tx.txt --keypair usb://ledger?key=0 --url https://api.mainnet-beta.solana.com\n");
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  console.error(err.stack);
  process.exit(1);
});