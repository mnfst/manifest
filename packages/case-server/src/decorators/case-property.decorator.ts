export const CaseProperty = (options: {
  seed: (index?: number) => any
}): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    Reflect.defineMetadata(`${propertyKey}:seed`, options.seed, target)
  }
}
