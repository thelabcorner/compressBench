declare module 'zstd-codec' {
  export const ZstdCodec: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    run: (callback: (zstd: any) => void) => void;
  };
}
