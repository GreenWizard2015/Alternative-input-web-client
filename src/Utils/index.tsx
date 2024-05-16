import murmur128 from 'murmur-128';

export function hash128Hex(str: string) {
  const hash: ArrayBuffer = murmur128(str);
  const hashView = new DataView(hash);
  let res = '';
  for (let i = 0; i < hash.byteLength; i++) {
    res += hashView.getUint8(i).toString(16).padStart(2, '0');
  }
  // add intermediate dash to make it more readable
  res = res.slice(0, 8) + '-' + res.slice(8, 12) + '-' + res.slice(12, 16) + '-' + res.slice(16, 20) + '-' + res.slice(20);
  if(36 !== res.length) {
    throw new Error('Unexpected hash length: ' + res.length);
  }
  return res;
}
