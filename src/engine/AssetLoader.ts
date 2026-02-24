import * as THREE from "three";

export class AssetLoader {
  private textureLoader = new THREE.TextureLoader();

  loadTexture(url: string) {
    return new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(url, resolve, undefined, reject);
    });
  }

  async loadTextureMap(entries: Record<string, string>) {
    const results = await Promise.all(
      Object.entries(entries).map(async ([key, url]) => {
        const texture = await this.loadTexture(url);
        return [key, texture] as const;
      })
    );
    return Object.fromEntries(results);
  }
}

