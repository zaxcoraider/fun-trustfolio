const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

async function main() {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'out/RepoRegistry.sol/RepoRegistry.json'), 'utf8')
  );

  const provider = new ethers.JsonRpcProvider('https://evmrpc.0g.ai');
  const wallet = new ethers.Wallet('0xd8951a2cba9a130a9cc7f0b4e3919485f6257306a27a06581b718eb998fe7be8', provider);

  console.log('Deployer:', wallet.address);
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), '0G');

  const treasury = '0x36af176be22e07e094feb32cd7aa53aad2b688db';
  const oracle   = '0xdd4a9c002ec2d25bf6c7cc0444abc9bb6a2fc6c1';

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode.object, wallet);

  console.log('Deploying RepoRegistry...');
  const contract = await factory.deploy(treasury, oracle);
  console.log('Tx hash:', contract.deploymentTransaction().hash);

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log('\n✅ RepoRegistry deployed!');
  console.log('Address:', address);
  console.log('\nAdd to .env.local:');
  console.log(`NEXT_PUBLIC_REGISTRY_ADDRESS_MAINNET=${address}`);
  console.log('\nExplorer:', `https://chainscan.0g.ai/address/${address}`);
}

main().catch(e => { console.error(e); process.exit(1); });
