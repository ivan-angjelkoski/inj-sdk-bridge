export class CctpBridge {
  private constructor() {
    console.log("CctpBridge constructor");
  }

  static async create() {
    return new CctpBridge();
  }
}
