# link-type-definitions

[![GitHub stars](https://img.shields.io/github/stars/codejamninja/link-type-definitions.svg?style=social&label=Stars)](https://github.com/codejamninja/link-type-definitions)

> link type definitions

Link and use 3rd party typescript defintions without DefinitelyTyped.

I build this because it is not possible to use type definitions without copy pasting them to the `src/@types` folder or submitting a pull request (and getting it accepted) from DefinitelyTyped.

Please ★ this repo if you found it useful ★ ★ ★

## Installation

```sh
npm install -g link-type-definitions
```

## Dependencies

- [NodeJS](https://nodejs.org)

## Usage

You can manually setup the project to link type definitions, or you can use the cli to automate the setup..

### Setup your project

Navigate to the root of your project and run the following command.

```sh
link-type-definitions setup
```

This will add the following to your _package.json_.

_package.json_

```json
{
  "scripts": {
    "postinstall": "link-type-definitions link"
  },
  "devDependencies": {
    "link-type-definitions": "^0.2.5"
  },
  "linkTypeDefinitions": []
}
```

You may need to reinstall your dependencies after running the setup.

```sh
npm install
```

### Install npm modules that contain type definitions

```sh
npm install --save-dev <SOME_NPM_MODULE>
```

### Link the modules types

Note that the module must be added to the package.json `dependencies` or `devDependancies` before linking its type definitions. Use the `-S` flag if you want to add the linked dependencies to the _package.json_.

```sh
link-type-definitions -S <SOME_NPM_MODULE>
```

## Support

Submit an [issue](https://github.com/codejamninja/link-type-definitions/issues/new)

## Screenshots

[Contribute](https://github.com/codejamninja/link-type-definitions/blob/master/CONTRIBUTING.md) a screenshot

## Contributing

Review the [guidelines for contributing](https://github.com/codejamninja/link-type-definitions/blob/master/CONTRIBUTING.md)

## License

[MIT License](https://github.com/codejamninja/link-type-definitions/blob/master/LICENSE)

[Jam Risser](https://codejam.ninja) © 2019

## Changelog

Review the [changelog](https://github.com/codejamninja/link-type-definitions/blob/master/CHANGELOG.md)

## Credits

- [Jam Risser](https://codejam.ninja) - Author

## Support on Liberapay

A ridiculous amount of coffee ☕ ☕ ☕ was consumed in the process of building this project.

[Add some fuel](https://liberapay.com/codejamninja/donate) if you'd like to keep me going!

[![Liberapay receiving](https://img.shields.io/liberapay/receives/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
[![Liberapay patrons](https://img.shields.io/liberapay/patrons/codejamninja.svg?style=flat-square)](https://liberapay.com/codejamninja/donate)
