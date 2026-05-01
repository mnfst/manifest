import { getMetadataArgsStorage } from 'typeorm';
import { BenchmarkRun } from './benchmark-run.entity';
import { BenchmarkColumn } from './benchmark-column.entity';

/**
 * Both entities expose lazy `() => OtherEntity` factory closures on their
 * relation decorators (TypeORM uses lazy resolution to break circular
 * imports). Coverage tools count those closures as their own functions, so
 * we explicitly invoke them here — otherwise the factories sit at 0% even
 * though the relation metadata is exercised in real DB tests.
 */
describe('BenchmarkRun / BenchmarkColumn relations', () => {
  it('OneToMany on BenchmarkRun.columns resolves to BenchmarkColumn with inverse `run`', () => {
    const relations = getMetadataArgsStorage().relations.filter((r) => r.target === BenchmarkRun);
    const oneToMany = relations.find((r) => r.relationType === 'one-to-many');
    expect(oneToMany).toBeDefined();

    const resolved = (oneToMany!.type as () => unknown)();
    expect(resolved).toBe(BenchmarkColumn);

    const column = new BenchmarkColumn();
    column.run = new BenchmarkRun();
    const inverseFn = oneToMany!.inverseSideProperty as (c: BenchmarkColumn) => unknown;
    expect(inverseFn(column)).toBe(column.run);
  });

  it('ManyToOne on BenchmarkColumn.run resolves to BenchmarkRun with inverse `columns`', () => {
    const relations = getMetadataArgsStorage().relations.filter(
      (r) => r.target === BenchmarkColumn,
    );
    const manyToOne = relations.find((r) => r.relationType === 'many-to-one');
    expect(manyToOne).toBeDefined();

    const resolved = (manyToOne!.type as () => unknown)();
    expect(resolved).toBe(BenchmarkRun);

    const run = new BenchmarkRun();
    run.columns = [new BenchmarkColumn()];
    const inverseFn = manyToOne!.inverseSideProperty as (r: BenchmarkRun) => unknown;
    expect(inverseFn(run)).toBe(run.columns);
  });
});
