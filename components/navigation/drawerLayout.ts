export const getNavDrawerTopClass = (os: string | undefined): 'top-8' | 'top-0' =>
  os === 'darwin' ? 'top-8' : 'top-0';
