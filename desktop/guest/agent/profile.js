'use strict';

const DIR = '/run/rfactory/profile';
const MAPPER = 'rfprofile';

// exec(cmd, argv, { input }) -> Promise. The key goes only on stdin, never argv or env.
// The key arrives base64 so binary key files survive JSON; it is passed on as the raw bytes.
const BLANK_BYTES = 16 * 1024 * 1024;
// Read in-process: the unit's PATH has no diffutils, so shelling out to cmp would fail with ENOENT.
async function readHead(dev) {
  const fh = await require('node:fs/promises').open(dev, 'r');
  try {
    const buf = Buffer.alloc(BLANK_BYTES);
    let n = 0;
    for (let r; n < BLANK_BYTES && (r = (await fh.read(buf, n, BLANK_BYTES - n, n)).bytesRead) > 0;) n += r;
    return buf.subarray(0, n);
  } finally { await fh.close(); }
}

function createProfile(exec, readSerial = () => require('node:fs/promises').readFile('/sys/block/vdb/serial', 'utf8'), read = readHead) {
  let attached = false;
  const dev = '/dev/vdb';
  // Deviation 4: format only a provably new disk. Anything else fails closed and never writes: an initialized profile
  // (or a message that does not say otherwise) is only opened, so a missing LUKS header makes cryptsetup open fail.
  async function format(key, id) {
    if (typeof id !== 'string') throw new Error('profile id missing');
    const serial = (await readSerial()).trim();
    // virtio-blk serials are 20 bytes at most, so the full id may arrive cut
    if (serial !== id && serial !== id.slice(0, 20)) throw new Error('profile disk serial mismatch');
    // a failed read is as bad as data: refuse rather than format
    const head = await read(dev).catch((e) => { throw new Error(`profile disk is not blank: cannot read it (${e.code || e.message})`); });
    if (head.length < BLANK_BYTES || head.some((b) => b !== 0)) throw new Error('profile disk is not blank');
    await exec('cryptsetup', ['luksFormat', '--batch-mode', '--key-file=-', dev], { input: key });
    return true;
  }
  return {
    get attached() { return attached; },
    // opts = the control message: { profile_id, initialized }
    async attach(key, { profile_id: id, initialized } = {}) {
      if (attached) throw new Error('profile already attached');
      const raw = Buffer.from(key, 'base64');
      const fresh = initialized === false && await format(raw, id);
      await exec('cryptsetup', ['open', '--key-file=-', dev, MAPPER], { input: raw });
      try {
        if (fresh) await exec('mkfs.ext4', ['-q', `/dev/mapper/${MAPPER}`]);
        await exec('mkdir', ['-p', DIR]);
        await exec('mount', ['-o', 'nodev,nosuid,noexec', `/dev/mapper/${MAPPER}`, DIR]);
        await exec('mkdir', ['-p', `${DIR}/chrome`]);
        await exec('chown', ['rfchrome:rfchrome', `${DIR}/chrome`]); // the control Chrome is not root
      } catch (e) {
        await exec('cryptsetup', ['close', MAPPER]).catch(() => {});
        throw e;
      }
      attached = true;
      return `${DIR}/chrome`;
    },
    // The caller closes Chrome first; then unmount, then close the mapping.
    async detach() {
      if (!attached) return;
      attached = false;
      try { await exec('umount', [DIR]); } finally { await exec('cryptsetup', ['close', MAPPER]); }
    },
  };
}

module.exports = { createProfile, readHead, DIR };
