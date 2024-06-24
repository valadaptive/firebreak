# Firebreak

This is a command-line utility for tracking and traversing NPM packages' dependencies in various ways, such as searching for nested dependencies or seeing which popular packages depend on certain other packages. It makes use of the [ecosyste.ms API](https://packages.ecosyste.ms).

## Usage

After cloning this repo, run `npm run firebreak -- [args]` to execute the main CLI utility. It has a few different subcommands which you can learn about using `npm run firebreak -- help`, or use `npm run firebreak -- help [subcommand]` to learn more about a specific subcommand.

### `depsearch`

This subcommand allows you to search for a nested dependency within a given package. All versions of the nested dependency will be searched for.

### `popular-reverse-deps`

This subcommand allows you to view the most popular reverse dependencies for a given package. Note that the ecosyste.ms API doesn't seem to return accurate results, so this may omit many packages.

### `popular-packages-containing`

This subcommand allows you to view the most popular packages containing a given nested dependency. It displays all paths from the root packages to the dependency in question.

## Configuration

Configuration is done with environment variables; `.env` is supported. Currently, there's only one option, `CACHE_DIR`, which controls where cached API and registry requests are stored.