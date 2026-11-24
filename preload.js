const { contextBridge, ipcRenderer } = require('electron');
const inv = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('lw', {
  status: inv('status'),
  login: inv('login'),
  logout: inv('logout'),
  nowPlaying: inv('nowPlaying'),
  fetchImage: inv('fetchImage'),
  lyrics: inv('lyrics'),
  control: inv('control'),
  toggleFullscreen: inv('toggleFullscreen'),
  toggleOnTop: inv('toggleOnTop'),
  setOnTop: inv('setOnTop'),
  setFullscreen: inv('setFullscreen'),
  placePhoto: inv('placePhoto'),
  pickImage: inv('pickImage'),
  pickFolder: inv('pickFolder'),
  listImages: inv('listImages'),
  readImage: inv('readImage'),
  openExternal: inv('openExternal'),
  quit: inv('quit'),
});
