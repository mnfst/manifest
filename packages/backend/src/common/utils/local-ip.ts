const FFMPEG_PREFIX = '::ffff:';

export function isLoopbackIp(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function parseIpv4(ip: string): string {
  return ip.startsWith(FFMPEG_PREFIX) ? ip.slice(FFMPEG_PREFIX.length) : ip;
}

function isPrivateIpv4(ipv4: string): boolean {
  const parts = ipv4.split('.');
  if (parts.length !== 4) return false;

  const [a, b] = parts.map(Number);

  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;

  return false;
}

export function isAllowedLocalIp(ip: string): boolean {
  if (isLoopbackIp(ip)) return true;
  const ipv4 = parseIpv4(ip);
  return isPrivateIpv4(ipv4);
}
