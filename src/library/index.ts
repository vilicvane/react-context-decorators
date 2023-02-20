import hoistStatics from 'hoist-non-react-statics';
import type {Component, ComponentType, Consumer, Context} from 'react';
import {createElement, forwardRef, useContext} from 'react';
import type {KeyOfValueWithType} from 'tslang';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export type UseDecorator<T> = <TComponent extends Component>(
  Component: TComponent,
  key:
    | KeyOfValueWithType<TComponent, T>
    | {Error: 'Type of property does not match'},
) => any;

export function use<T>(Context: Context<T>): UseDecorator<T>;
export function use<T>(Context: Context<T>): any {
  return (componentPrototype: object, key: string | symbol) => {
    pushContext(componentPrototype, key, Context, key, function (this: any) {
      return this.props._contextProps[key];
    });
  };
}

export type UsePropertyDecorator<
  T extends object,
  TPropertyName extends keyof T | void,
> = <TComponent extends Component>(
  componentPrototype: TComponent,
  key: TPropertyName extends string
    ?
        | KeyOfValueWithType<TComponent, T[TPropertyName]>
        | {Error: `Type of property does not match '${TPropertyName}'`}
    :
        | {
            [TKey in keyof T]: TComponent extends {
              [TComponentKey in TKey]: T[TKey];
            }
              ? TKey
              : never;
          }[keyof T]
        | {Error: 'Type of property does not match'},
) => any;

export function buildUsePropertyDecorator<T extends object>(
  contextKey: string,
  Context: Context<T>,
): {
  (): UsePropertyDecorator<T, void>;
  <TPropertyName extends keyof T>(name: TPropertyName): UsePropertyDecorator<
    T,
    TPropertyName
  >;
};
export function buildUsePropertyDecorator(
  contextKey: string,
  Context: Context<object>,
): (name?: string | symbol) => any {
  return name => (componentPrototype: object, key: string | symbol) => {
    pushContext(
      componentPrototype,
      contextKey,
      Context,
      key,
      function (this: any) {
        return this.props._contextProps[contextKey][name ?? key];
      },
    );
  };
}

function pushContext(
  componentPrototype: any,
  key: string | symbol,
  Context: Context<any>,
  getterKey: string | symbol,
  getter: () => any,
): void {
  if (hasOwnProperty.call(componentPrototype, '_contexts')) {
    componentPrototype._contexts.set(key, Context);
  } else {
    Object.defineProperty(componentPrototype, '_contexts', {
      value: new Map<string | symbol, Context<any>>(
        componentPrototype._contexts
          ? [...componentPrototype._contexts, [key, Context]]
          : [[key, Context]],
      ),
    });
  }

  if (hasOwnProperty.call(componentPrototype, '_contextGetters')) {
    componentPrototype._contextGetters.set(getterKey, getter);
  } else {
    Object.defineProperty(componentPrototype, '_contextGetters', {
      value: new Map<string | symbol, () => any>(
        componentPrototype._contextGetters
          ? [...componentPrototype._contextGetters, [getterKey, getter]]
          : [[getterKey, getter]],
      ),
    });
  }
}

export function context(Component: ComponentType): any {
  if (typeof Component.prototype !== 'object') {
    return Component;
  }

  const contexts = Component.prototype._contexts as
    | Map<string, Consumer<any>>
    | undefined;

  if (contexts) {
    const OriginalComponent = Component;

    Component = forwardRef((props, ref) => {
      const contextProps: any = {};

      for (const [key, Context] of contexts!) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        contextProps[key] = useContext((Context as any)._context || Context);
      }

      // eslint-disable-next-line @mufan/no-object-literal-type-assertion
      return createElement(OriginalComponent, {
        ...props,
        _contextProps: contextProps,
        ref,
      } as any);
    }) as any;

    hoistStatics(Component, OriginalComponent);
  } else {
    console.warn('No contexts used', Component);
  }

  return Component;
}

export function applyContextGetters(component: Component): void {
  const getterMap = (component as any)._contextGetters;

  if (!getterMap) {
    console.warn('No context getter added', component);
    return;
  }

  for (const [key, getter] of getterMap) {
    Object.defineProperty(component, key, {
      get: getter,
    });
  }
}
