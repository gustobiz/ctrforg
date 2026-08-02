const headers = ["firstname", "channelname", "email", "videotitle", "videolink", "niche", "specificthing"];
const mapping = {
  name: 'Name',
  email: 'Email',
  channel: 'Channel',
  subscribers: 'Subscribers',
  notes: 'Notes',
};

const getIndex = (key, defaultName) => {
  const preferred = (mapping[key] || defaultName).toLowerCase();
  // 1. Try exact match
  let idx = headers.indexOf(preferred);
  if (idx !== -1) return idx;
  // 2. Try partial match
  idx = headers.findIndex(h => h && (h.includes(preferred) || preferred.includes(h)));
  if (idx !== -1) return idx;
  // 3. Robust fallbacks based on common domain terms
  if (key === 'name') {
    return headers.findIndex(h => h.includes('name') || h.includes('creator') || h.includes('lead') || h.includes('contact') || h.includes('title'));
  }
  if (key === 'email') {
    return headers.findIndex(h => h.includes('email') || h.includes('mail') || h.includes('contact'));
  }
  if (key === 'channel') {
    return headers.findIndex(h => h.includes('channel') || h.includes('youtube') || h.includes('account') || h.includes('company'));
  }
  if (key === 'subscribers') {
    return headers.findIndex(h => h.includes('subscriber') || h.includes('subs') || h.includes('count') || h.includes('followers'));
  }
  if (key === 'notes') {
    return headers.findIndex(h => h.includes('note') || h.includes('info') || h.includes('desc') || h.includes('comment'));
  }
  if (key === 'website') {
    return headers.findIndex(h => h.includes('website') || h.includes('url') || h.includes('link') || h.includes('site'));
  }
  return -1;
};

console.log('nameIdx:', getIndex('name', 'Name'), headers[getIndex('name', 'Name')]);
console.log('emailIdx:', getIndex('email', 'Email'), headers[getIndex('email', 'Email')]);
console.log('channelIdx:', getIndex('channel', 'Channel'), headers[getIndex('channel', 'Channel')]);
console.log('subIdx:', getIndex('subscribers', 'Subscribers'), headers[getIndex('subscribers', 'Subscribers')]);
console.log('notesIdx:', getIndex('notes', 'Notes'), headers[getIndex('notes', 'Notes')]);
console.log('websiteIdx:', getIndex('website', 'Website'), headers[getIndex('website', 'Website')]);
