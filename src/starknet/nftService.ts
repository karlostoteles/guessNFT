/**
 * NFT ownership querying for SCHIZODIO collection.
 * Uses raw starknet.js RPC calls to read ERC-721 contract state.
 */
import {
  RpcProvider,
  Contract,
  uint256,
  byteArray as byteArrayUtils,
  shortString,
  type Abi,
  type ArgsOrCalldata,
} from 'starknet';
import { SCHIZODIO_CONTRACT, RPC_URL } from './config';
import type { SchizodioNFT, NFTAttribute } from './types';

// ── IPFS gateway — cloudflare is more reliable and CORS-permissive ────────────
const IPFS_GATEWAY = 'https://cloudflare-ipfs.com/ipfs/';

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
  // camelCase variants
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
 * Decode a raw starknet.js call result to a string.
 *
 * Starknet contracts can return URIs in several formats:
 *   1. Already a JS string (starknet.js auto-decoded ByteArray)
 *   2. BigInt / felt252 (short string ≤31 chars)
 *   3. ByteArray object {data, pending_word, pending_word_len}
 *   4. Array of felt252s (concatenated short strings)
 */
function decodeStarknetString(raw: any): string {
  if (typeof raw === 'string') {
    // Could be hex-encoded felt — try decoding if it looks like one
    if (/^0x[0-9a-fA-F]+$/.test(raw) && !raw.includes('://') && !raw.startsWith('data:')) {
      try {
        const decoded = shortString.decodeShortString(raw);
        if (decoded.includes('://') || decoded.startsWith('data:') || decoded.startsWith('ipfs')) {
          return decoded;
        }
      } catch { /* not a short string — keep as-is */ }
    }
    return raw;
  }

  if (typeof raw === 'bigint') {
    try {
      return shortString.decodeShortString('0x' + raw.toString(16));
    } catch {
      return raw.toString();
    }
  }

  // ByteArray {data: bigint[], pending_word: bigint, pending_word_len: number}
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if ('data' in raw || 'pending_word' in raw) {
      try {
        return byteArrayUtils.stringFromByteArray(raw as any);
      } catch {
        /* fall through */
      }
    }
    // Might be a single-key object wrapping the value
    const keys = Object.keys(raw);
    if (keys.length === 1) return decodeStarknetString(raw[keys[0]]);
  }

  // Array of felts — concatenate decoded short strings
  if (Array.isArray(raw) && raw.length > 0) {
    try {
      return raw.map((f: any) => {
        try {
          return shortString.decodeShortString(typeof f === 'bigint' ? '0x' + f.toString(16) : String(f));
        } catch {
          return '';
        }
      }).join('');
    } catch { /* fall through */ }
  }

  const s = String(raw);
  return s === '[object Object]' ? '' : s;
}

/**
 * Resolve IPFS and HTTP URIs to usable HTTP URLs.
 * Also handles base64-encoded data URIs (on-chain metadata).
 */
function resolveUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', IPFS_GATEWAY);
  }
  // Already HTTP/HTTPS or data URI
  return url;
}

/**
 * Try calling a contract function, attempting snake_case then camelCase.
 */
async function tryCall(
  contract: Contract,
  snakeName: string,
  camelName: string,
  args: ArgsOrCalldata,
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
  console.log(`[nftService] ${ownerAddress} owns ${balance} tokens`);

  if (balance === 0) return [];

  const tokenIds: string[] = [];
  const BATCH_SIZE = 5;

  for (let i = 0; i < balance; i += BATCH_SIZE) {
    const batch = Array.from(
      { length: Math.min(BATCH_SIZE, balance - i) },
      (_, j) => i + j,
    );

    const results = await Promise.all(
      batch.map(async (index) => {
        try {
          const result = await tryCall(
            contract,
            'token_of_owner_by_index',
            'tokenOfOwnerByIndex',
            [ownerAddress, uint256.bnToUint256(BigInt(index))],
          );
          return result.toString();
        } catch (err) {
          console.warn(`[nftService] Failed to fetch token at index ${index}:`, err);
          return null;
        }
      }),
    );

    tokenIds.push(...results.filter((id): id is string => id !== null));
  }

  console.log(`[nftService] Token IDs:`, tokenIds);
  return tokenIds;
}

/**
 * Parse metadata JSON — handles both plain JSON and
 * base64-encoded data URIs (on-chain NFTs).
 */
function parseMetadata(raw: string): any {
  // data:application/json;base64,...
  if (raw.startsWith('data:')) {
    const base64Part = raw.split(',')[1];
    if (base64Part) {
      try {
        return JSON.parse(atob(base64Part));
      } catch { /* fall through */ }
    }
  }
  // data:application/json,...  (URI-encoded)
  if (raw.startsWith('data:') && raw.includes(',')) {
    try {
      return JSON.parse(decodeURIComponent(raw.split(',')[1]));
    } catch { /* fall through */ }
  }
  return JSON.parse(raw);
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

  let rawUriResult: any;
  try {
    rawUriResult = await tryCall(
      contract,
      'token_uri',
      'tokenURI',
      [uint256.bnToUint256(BigInt(tokenId))],
    );
  } catch (err) {
    console.warn(`[nftService] token_uri call failed for #${tokenId}:`, err);
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
  }

  console.log(`[nftService] Token #${tokenId} raw URI result (type: ${typeof rawUriResult}):`, rawUriResult);

  const uri = decodeStarknetString(rawUriResult);
  console.log(`[nftService] Token #${tokenId} decoded URI:`, uri);

  if (!uri) {
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
  }

  // If the URI itself is a data URI (on-chain metadata), parse directly
  if (uri.startsWith('data:')) {
    try {
      const metadata = parseMetadata(uri);
      const imageUrl = resolveUrl(
        metadata.image || metadata.image_url || metadata.image_data || '',
      );
      console.log(`[nftService] Token #${tokenId} on-chain image:`, imageUrl);
      return {
        name: metadata.name || `SCHIZODIO #${tokenId}`,
        imageUrl,
        attributes: metadata.attributes || [],
      };
    } catch (err) {
      console.warn(`[nftService] Failed to parse on-chain metadata for #${tokenId}:`, err);
      return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
    }
  }

  // External metadata URI — fetch it
  try {
    const httpUrl = resolveUrl(uri);
    console.log(`[nftService] Token #${tokenId} fetching metadata from:`, httpUrl);
    const response = await fetch(httpUrl);
    const metadata = parseMetadata(await response.text());

    const imageUrl = resolveUrl(
      metadata.image || metadata.image_url || metadata.image_data || metadata.animation_url || '',
    );
    console.log(`[nftService] Token #${tokenId} imageUrl:`, imageUrl);

    return {
      name: metadata.name || `SCHIZODIO #${tokenId}`,
      imageUrl,
      attributes: metadata.attributes || [],
    };
  } catch (err) {
    console.warn(`[nftService] Metadata fetch failed for #${tokenId}:`, err);
    return { name: `SCHIZODIO #${tokenId}`, imageUrl: '', attributes: [] };
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
      }),
    );
    nfts.push(...results);
  }

  console.log(`[nftService] Final NFT objects:`, nfts);
  return nfts;
}
