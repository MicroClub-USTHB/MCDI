export type MockedMethods<T extends object> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? jest.Mock<R, A>
    : T[K];
};

export function createMethodMock<T extends (...args: any[]) => any>() {
  return jest.fn<ReturnType<T>, Parameters<T>>();
}

export function createMockedObject<T extends object>(
  methods: Partial<MockedMethods<T>>,
): MockedMethods<T> {
  return methods as MockedMethods<T>;
}
