declare module 'pdf-parse' {
  interface PDFInfo {
    numpages?: number;
    numPages?: number;
    [k: string]: any;
  }
  interface PDFResult extends PDFInfo {
    text: string;
    info?: any;
    metadata?: any;
    version?: string;
  }
  function pdf(data: Buffer | Uint8Array | ArrayBuffer, options?: any): Promise<PDFResult>;
  export = pdf;
}
