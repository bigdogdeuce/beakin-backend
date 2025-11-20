const { Connection, PublicKey, TransactionMessage, VersionedTransaction, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require("@solana/spl-token");
const fs = require("fs");

async function main() {
  console.log("🚀 Building Initialize Transaction...\n");
  
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
  console.log("Vault Authority:", vaultAuthority.toString());
  console.log("Vault Authority Bump:", vaultAuthorityBump);
  console.log("Vault ATA:", vaultAta.toString());
  console.log("\n⚠️  This transaction MUST be signed by:", admin.toString());
  
  // Load IDL to get discriminator
  const idl = JSON.parse(fs.readFileSync("beakin_vault.json", "utf8"));
  const initializeIx = idl.instructions.find(ix => ix.name === "initialize");
  
  if (!initializeIx) {
    throw new Error("Initialize instruction not found in IDL");
  }
  
  console.log("\n✅ Found initialize instruction");
  console.log("Discriminator:", initializeIx.discriminator);
  
  // Build instruction data: [discriminator (8 bytes), vault_authority_bump (1 byte)]
  const discriminator = Buffer.from(initializeIx.discriminator);
  const bumpByte = Buffer.from([vaultAuthorityBump]);
  const data = Buffer.concat([discriminator, bumpByte]);
  
  console.log("\n📝 Instruction data (hex):", data.toString('hex'));
  console.log("   Discriminator:", discriminator.toString('hex'));
  console.log("   Bump:", vaultAuthorityBump);
  
  console.log("\n✅ Transaction ready to be built and signed with Ledger!");
  console.log("\nNext: We need to use Ledger hardware wallet libraries to sign this.");
  console.log("The transaction needs to be signed by your Ledger at:", admin.toString());
}

main().catch(err => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});