export type ZipEntry = {
  name: string;
  data: Uint8Array;
};

const CRC32_TABLE = new Uint32Array(256);

for (let index = 0; index < 256; index += 1) {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  CRC32_TABLE[index] = value >>> 0;
}

function calculateCrc32(data: Uint8Array) {
  let crc = 0xffffffff;

  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function makeLocalHeader(name: Uint8Array, data: Uint8Array, crc: number) {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0x0021, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, data.length, true);
  view.setUint32(22, data.length, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  header.set(name, 30);

  return header;
}

function makeCentralHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  localOffset: number,
) {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0x0021, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, data.length, true);
  view.setUint32(24, data.length, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  header.set(name, 46);

  return header;
}

function makeEndRecord(entryCount: number, centralSize: number, centralOffset: number) {
  const record = new Uint8Array(22);
  const view = new DataView(record.buffer);

  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralOffset, true);
  view.setUint16(20, 0, true);

  return record;
}

/**
 * Build a ZIP archive using the STORE method.
 * Image files are already compressed by their own formats, so recompressing
 * them would add CPU cost without meaningful size savings.
 */
export function createZip(entries: ZipEntry[]) {
  if (entries.length === 0) {
    throw new Error("Tidak ada file yang bisa dimasukkan ke ZIP.");
  }

  if (entries.length > 0xffff) {
    throw new Error("Jumlah file melebihi batas arsip ZIP.");
  }

  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);

    if (name.length > 0xffff || entry.data.length > 0xffffffff) {
      throw new Error("Nama atau ukuran file tidak didukung oleh format ZIP.");
    }

    const crc = calculateCrc32(entry.data);
    const localHeader = makeLocalHeader(name, entry.data, crc);
    const centralHeader = makeCentralHeader(name, entry.data, crc, localOffset);

    localParts.push(localHeader, entry.data);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + entry.data.length;
    centralSize += centralHeader.length;
  }

  const endRecord = makeEndRecord(entries.length, centralSize, localOffset);
  const archiveParts = [...localParts, ...centralParts, endRecord];

  return new Blob(archiveParts as BlobPart[], { type: "application/zip" });
}
