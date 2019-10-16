# tsdpm

[![GitHub stars](https://img.shields.io/github/stars/codejamninja/tsdpm.svg?style=social&label=Stars)](https://github.com/codejamninja/tsdpm)

> typescript definition package manager

Install and publish 3rd party typescript defintions without DefinitelyTyped.

I build this because it is not possible to use type definitions without copy pasting them to the `src/@types` folder or submitting a pull request (and getting it accepted) from DefinitelyTyped.

Please ★ this repo if you found it useful ★ ★ ★

## Features

- install typescript definitions from npm
- publish typescript definitions to npm

## Installation

```sh
npm install --dev tsdpm
```

## Dependencies

- [NodeJS](https://nodejs.org)

## Usage

Simply add the npm modules with the type defintions to the `typeDefintions` section in your `package.json` file.

```sh
tsdpm install
```

It is recommended to add `tsdpm install` script to the the `postinstall` script.

### Example

_Notice that you can install type definition that are not part of DefinitelyTypes `@types/example`_

```json
{
  "name": "example",
  "scripts": {
    "postinstall": "tsdpm install"
  },
  "devDependancies": {
    "tsdpm": "^0.0.2"
  },
  "typeDefinitions": {
    "some-random-types": "0.0.1"
  }
}
```

## Support

Submit an [issue](https://github.com/codejamninja/tsdpm/issues/new)

## Screenshots

[Contribute](https://github.com/codejamninja/tsdpm/blob/master/CONTRIBUTING.md) a screenshot

## Contributing

Review the [guidelines for contributing](https://github.com/codejamninja/tsdpm/blob/master/CONTRIBUTING.md)

## License

[MIT License](https://github.com/codejamninja/tsdpm/blob/master/LICENSE)

[Jam Risser](https://codejam.ninja) © 2019

## Changelog

Review the [changelog](https://github.com/codejamninja/tsdpm/blob/master/CHANGELOG.md)

## Credits

- [Jam Risser](https://codejam.ninja) - Author

## Support on Liberapay

A ridiculous amount of coffee ☕ ☕ ☕ was consumed in the process of building this project.

[Add some fuel](https://liberapay.com/codejamninja/donate) if you'd like to keep me going!

[![Liberapay receiving](https://img.shields.io/liberapay/receives/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
[![Liberapay patrons](https://img.shields.io/liberapay/patrons/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
