// Lightweight @opentelemetry/resources shim.
// Provides the Resource class without machine-id/host-id detectors
// that pull in fs.readFile (flagged by plugin scanners).

class Resource {
  constructor(attributes, asyncAttributesPromise) {
    this._attributes = attributes || {};
    this._syncAttributes = this._attributes;
    this.asyncAttributesPending = asyncAttributesPromise != null;
    if (asyncAttributesPromise) {
      this._asyncAttributesPromise = asyncAttributesPromise.then(
        (attrs) => {
          this._attributes = Object.assign({}, this._attributes, attrs);
          this.asyncAttributesPending = false;
          return attrs;
        },
        () => { this.asyncAttributesPending = false; return {}; }
      );
    }
  }

  get attributes() { return this._attributes || {}; }

  waitForAsyncAttributes() {
    return this.asyncAttributesPending
      ? this._asyncAttributesPromise
      : Promise.resolve();
  }

  merge(other) {
    if (!other) return this;
    const merged = Object.assign(
      {},
      this._syncAttributes,
      other._syncAttributes || other.attributes,
    );
    return new Resource(merged);
  }
}

Resource.EMPTY = new Resource({});
Resource.empty = function () { return Resource.EMPTY; };
Resource.default = function () {
  return new Resource({ "telemetry.sdk.language": "nodejs" });
};

module.exports = { Resource };
