/**
 * NFT ownership querying for SCHIZODIO collection.
 * Uses raw starknet.js RPC calls to read ERC-721 contract state.
 */
import { RpcProvider, Contract, uint256, type Abi, type ArgsOrCalldata } from 'starknet';
import { SCHIZODIO_CONTRACT, RPC_URL } from './config';
import type { SchizodioNFT, NFTAttribute } from './types';

// Minimal ERC-721 ABI for read operations (both camelCase and snake_case)
const ERC721_ABI: Abi = [
  {
    name: 'balance_of',
    type: 'function',
    inputs: [{ name: 'owner', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'token_of_owner_by_index',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'index', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'token_uri',
    type: 'function',
    inputs: [{ name: 'token_id', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::byte_array::ByteArray' }],
    state_mutability: 'view',
  },
  // camelCase variants (some contracts use these)
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'owner', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'tokenOfOwnerByIndex',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'index', type: 'core::integer::u256' },
    ],
    outputs: [{ type: 'core::integer::u256' }],
    state_mutability: 'view',
  },
  {
    name: 'tokenURI',
    type: 'function',
    inputs: [{ name: 'token_id', type: 'core::integer::u256' }],
    outputs: [{ type: 'core::byte_array::ByteArray' }],
    state_mutability: 'view',
  },
] as unknown as Abi;

function getProvider() {
  return new RpcProvider({ nodeUrl: RPC_URL });
}

function getContract() {
  return new Contract({
    abi: ERC721_ABI,
    address: SCHIZODIO_CONTRACT,
    providerOrAccount: getProvider(),
  });
}

/**
 * Try calling a contract function, attempting snake_case then camelCase.
 */
async function tryCall(
  contract: Contract,
  snakeName: string,
  camelName: string,
  args: ArgsOrCalldata
): Promise<any> {
  try {
    return await contract.call(snakeName, args);
  } catch {
    return await contract.call(camelName, args);
  }
}

/**
 * Fetch all token IDs owned by an address.
 */
export async function fetchOwnedTokenIds(ownerAddress: string): Promise<string[]> {
  const contract = getContract();

  const balanceResult = await tryCall(contract, 'balance_of', 'balanceOf', [ownerAddress]);
  const balance = Number(BigInt(balanceResult.toString()));

  if (balance === 0) return [];

  const tokenIds: string[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < balance; i += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, balance - i) },
      (_, j) => i + j
    );

    const results = await Promise.all(
      batch.map(async (index) => {
        try {
          const result = await tryCall(
            contract,
            'token_of_owner_by_index',
            'tokenOfOwnerByIndex',
            [ownerAddress, uint256.bnToUint256(BigInt(index))]
          );
          return result.toString();
        } catch (err) {
          console.warn(`Failed to fetch token at index ${index}:`, err);
          return null;
        }
      })
    );

    tokenIds.push(...results.filter((id): id is string => id !== null));
  }

  return tokenIds;
}

/**
 * Resolve IPFS URIs to HTTP URLs.
 */
function resolveUrl(url: string): string {
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return url;
}

/**
 * Fetch metadata for a single token.
 */
export async function fetchTokenMetadata(tokenId: string): Promise<{
  name: string;
  imageUrl: string;
  attributes: NFTAttribute[];
}> {
  const contract = getContract();

  let uri: string;
  try {
    const result = await tryCall(
      contract,
      'token_uri',
      'tokenURI',
      [uint256.bnToUint256(BigInt(tokenId))]
    );
    uri = result.toString();
  } catch {
    // If tokenURI fails, return placeholder
    return {
      name: `SCHIZODIO #${tokenId}`,
      imageUrl: '',
      attributes: [],
    };
  }

  try {
    const httpUrl = resolveUrl(uri);
    const response = await fetch(httpUrl);
    const metadata = await response.json();

    return {
      name: metadata.name || `SCHIZODIO #${tokenId}`,
      imageUrl: resolveUrl(metadata.image || metadata.image_url || ''),
      attributes: metadata.attributes || [],
    };
  } catch {
    return {
      name: `SCHIZODIO #${tokenId}`,
      imageUrl: '',
      attributes: [],
    };
  }
}

/**
 * Fetch all owned NFTs with metadata.
 */
export async function fetchAllOwnedNFTs(ownerAddress: string): Promise<SchizodioNFT[]> {
  const tokenIds = await fetchOwnedTokenIds(ownerAddress);

  const nfts: SchizodioNFT[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (tokenId) => {
        const meta = await fetchTokenMetadata(tokenId);
        return { tokenId, ...meta };
      })
    );
    nfts.push(...results);
  }

  return nfts;
}
