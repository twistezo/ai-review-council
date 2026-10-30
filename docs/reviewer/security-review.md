# Security review

Trace untrusted input to where it is used. Check the change for:

- **Injection**: input reaching SQL, shell, HTML, paths or templates without validation or escaping.
- **Access control**: authentication and authorization on every new entry point.
- **Secrets**: credentials or tokens in code, logs, errors or client bundles.
- **Data exposure**: personal or internal data returned, logged or stored beyond need.
- **Dependencies and crypto**: new packages, weak algorithms, homemade crypto.
