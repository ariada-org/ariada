export function useMDXComponents(components) {
  return {
    wrapper: ({ children }) => <main>{children}</main>,
    ...components,
  };
}
