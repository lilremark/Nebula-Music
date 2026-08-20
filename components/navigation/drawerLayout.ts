export const getNavDrawerTopClass = (os: string | undefined): 'top-8' | 'top-0' =>
  os === 'darwin' || os === 'win32' ? 'top-8' : 'top-0';
