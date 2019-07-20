import * as dotenv from 'dotenv';
import { system, filesystem } from 'gluegun';
import * as path from 'path';

import { spyOnStd, callWarthogCLI } from '../../test/helpers';

const root = filesystem.path(__dirname, '../../');

const GENERATED_FOLDER = 'tmp/generated';

// import { Config } from '../../src/';

describe('cli functional tests', () => {
  const spy = spyOnStd(); // Gives us access to whatever is written to stdout as part of the CLI command

  afterAll(() => {
    filesystem.dirAsync(GENERATED_FOLDER); // cleanup test artifacts
  });

  beforeEach(() => {
    clearConfig();
    jest.setTimeout(20000);
  });

  afterAll(() => {
    filesystem.remove(GENERATED_FOLDER); // cleanup test artifacts
  });

  // This test actually calls the CLI via a system call.  This won't count towards test coverage
  // but it's the most thorough way we can actually check to see if everything is wired up correctly
  test('spin up an actual process to test the full cli is wired up', async done => {
    // Construct the environment variables here so that they're passed into cli command
    const dotenvConfig = dotenv.config({ path: path.join(__dirname, './.env.test') });

    const env = {
      ...process.env,
      ...dotenvConfig.parsed
    };

    const output = await system.run(
      'node ' + filesystem.path(root, 'bin', 'warthog') + ' --version',
      {
        env
      }
    );

    // TODO: should we bother with this since we don't update the version in package.json?
    expect(output).toContain('0.0.0-development');
    // This makes sure we're actually getting the version command and not the standard "help" command, which also includes the version
    expect(output).not.toContain('help');
    done();
  });

  test('outputs help', async done => {
    await callWarthogCLI('--help');
    const stdout = spy.getStdOut();
    expect(stdout).toContain('generate (g)');
    done();
  });

  test('generates models', async done => {
    await callWarthogCLI(
      `generate user name! nickname numLogins:int! verified:bool! registeredAt:date balance:float! --folder ${GENERATED_FOLDER}`
    );
    const stdout = spy.getStdOut();

    let fileContents;

    expect(stdout).toContain(`Generated file at ${GENERATED_FOLDER}/user.model.ts`);
    fileContents = filesystem.read(`${GENERATED_FOLDER}/user.model.ts`);
    expect(fileContents).toContain('export class User');

    expect(fileContents).toContain('@StringField()');
    expect(fileContents).toContain('name!: string;');

    // This also checks that prettier was run to remove trailing comma
    expect(fileContents).toContain('@StringField({ nullable: true })');
    expect(fileContents).toContain('nickname?: string;');

    expect(fileContents).toContain('@IntField()');
    expect(fileContents).toContain('numLogins!: number;');

    expect(fileContents).toContain('@BooleanField()');
    expect(fileContents).toContain('verified!: boolean;');

    // This also checks that prettier was run to remove trailing comma
    expect(fileContents).toContain('@DateField({ nullable: true })');
    expect(fileContents).toContain('registeredAt?: Date;');

    expect(fileContents).toContain('@FloatField()');
    expect(fileContents).toContain('balance!: number;');

    expect(stdout).toContain(`Generated file at ${GENERATED_FOLDER}/user.service.ts`);
    fileContents = filesystem.read(`${GENERATED_FOLDER}/user.service.ts`);
    expect(fileContents).toContain("@Service('UserService')");

    expect(stdout).toContain(`Generated file at ${GENERATED_FOLDER}/user.resolver.ts`);
    fileContents = filesystem.read(`${GENERATED_FOLDER}/user.resolver.ts`);
    expect(fileContents).toContain('this.service.find<UserWhereInput>');

    done();
  });

  test('generates a shell of a file of no params specified', async done => {
    await callWarthogCLI(`generate empty_class --folder ${GENERATED_FOLDER}`);
    const stdout = spy.getStdOut();

    expect(stdout).toContain(`Generated file at ${GENERATED_FOLDER}/empty-class.model.ts`);
    const fileContents = filesystem.read(`${GENERATED_FOLDER}/empty-class.model.ts`);

    expect(fileContents).toContain('export class EmptyClass extends BaseModel');
    expect(fileContents).toContain('@StringField({ nullable: true })');
    expect(fileContents).toContain('fieldName?: string;');

    done();
  });

  test('requires name for db:create', async done => {
    // Make sure there is no DB name

    delete process.env.WARTHOG_DB_DATABASE;
    await callWarthogCLI('db:create');

    const stdout = spy.getStdOut();

    expect(stdout).toContain('Database name is required');

    done();
  });

  test('successfully creates and drops DBs', async done => {
    // TODO: clear out all existing warthog ENV vars
    delete process.env.WARTHOG_DB_DATABASE;
    dotenv.config({ path: path.join(__dirname, './.env.test') });
    let stdout;

    // First drop the DB if it's already there
    await callWarthogCLI('db:drop');
    spy.clear();

    await callWarthogCLI('db:create');
    stdout = spy.getStdOut();
    expect(stdout).toContain("Database 'warthog-starter' created!");
    spy.clear();

    await callWarthogCLI('db:create');
    stdout = spy.getStdOut();
    expect(stdout).toContain("Database 'warthog-starter' already exists");
    spy.clear();

    await callWarthogCLI('db:drop');
    stdout = spy.getStdOut();
    expect(stdout).toContain("Database 'warthog-starter' dropped!");
    spy.clear();

    await callWarthogCLI('db:drop');
    stdout = spy.getStdOut();
    expect(stdout).toContain("Database 'warthog-starter' does not exist");
    spy.clear();

    done();
  });
});

function clearConfig() {
  const WARTHOG_PREFIX = 'WARTHOG_';
  const TYPEORM_PREFIX = 'TYPEORM_';
  Object.keys(process.env).forEach(key => {
    if (key.startsWith(WARTHOG_PREFIX) || key.startsWith(TYPEORM_PREFIX)) {
      delete process.env[key];
    }
  });
}