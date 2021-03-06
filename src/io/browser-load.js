import {requestFile} from './browser-request-file';

export function loadFile(opts) {
  return requestFile(opts);
}

/* global Image */

/*
 * Loads images asynchronously
 * image.crossOrigin can be set via opts.crossOrigin, default to 'anonymous'
 * returns a promise tracking the load
 */
export function loadImage(url, opts = {
  crossOrigin: 'anonymous'
}) {
  return new Promise((resolve, reject) => {
    try {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load image ${url}.`));
      image.crossOrigin = opts.crossOrigin;
      image.src = url;
    } catch (error) {
      reject(error);
    }
  });
}
