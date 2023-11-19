import hoistStatics from 'hoist-non-react-statics';
import type {Component, ComponentType, Consumer, Context} from 'react';
import {createElement, forwardRef, useContext, useState} from 'react';

const hasOwnProperty = Object.prototype.hasOwnProperty;

export type UseDecorator<T> = <TComponent extends Component>(
  target: ClassAccessorDecoratorTarget<TComponent, T>,
  context: ClassAccessorDecoratorContext<TComponent, T>,
) => ClassAccessorDecoratorResult<TComponent, T>;

export function use<T>(Context: Context<T>): UseDecorator<T> {
  return (_target, {name, metadata, addInitializer}) => {
    pushContext(metadata, name, Context);

    let contextProps: any;

    addInitializer(function () {
      contextProps = (this.props as any)._contextProps;
    });

    return {
      get() {
        return contextProps[name];
      },
    };
  };
}

export type UsePropertyDecorator<
  TSource extends object,
  TPropertyName extends keyof TSource | void,
> = TPropertyName extends string
  ? <TComponent extends Component>(
      target: ClassAccessorDecoratorTarget<TComponent, TSource[TPropertyName]>,
      context: ClassAccessorDecoratorContext<
        TComponent,
        TSource[TPropertyName]
      >,
    ) => ClassAccessorDecoratorResult<TComponent, TSource[TPropertyName]>
  : <
      TComponent extends Component,
      TContext extends ClassAccessorDecoratorContext<TComponent>,
    >(
      target: ClassAccessorDecoratorTarget<
        TComponent,
        TSource[TContext['name'] & keyof TSource]
      >,
      context: TContext,
    ) => ClassAccessorDecoratorResult<
      TComponent,
      TSource[TContext['name'] & keyof TSource]
    >;

export type BuiltUsePropertyDecorator<T extends object> = {
  (): UsePropertyDecorator<T, void>;
  <TPropertyNameOverride extends keyof T>(
    name: TPropertyNameOverride,
  ): UsePropertyDecorator<T, TPropertyNameOverride>;
};

export function buildUsePropertyDecorator<T extends object>(
  contextKey: string,
  Context: Context<T>,
): BuiltUsePropertyDecorator<T>;
export function buildUsePropertyDecorator(
  contextKey: string,
  Context: Context<object>,
): (
  nameOverride?: string,
) => (
  target: ClassAccessorDecoratorTarget<object, unknown>,
  context: ClassAccessorDecoratorContext,
) => ClassAccessorDecoratorResult<object, unknown> {
  return nameOverride =>
    (_target, {name: decoratedName, metadata}) => {
      pushContext(metadata, contextKey, Context);

      const name = nameOverride ?? decoratedName;

      return {
        get(this: any) {
          return this.props._contextProps[contextKey][name];
        },
      };
    };
}

function pushContext(
  metadata: any,
  key: string | symbol,
  Context: Context<any>,
): void {
  if (hasOwnProperty.call(metadata, '_contexts')) {
    metadata._contexts.set(key, Context);
  } else {
    Object.defineProperty(metadata, '_contexts', {
      value: new Map<string | symbol, Context<any>>(
        metadata._contexts
          ? [...metadata._contexts, [key, Context]]
          : [[key, Context]],
      ),
    });
  }
}

export function context<TComponent extends ComponentType<any>>(
  Component: TComponent,
): TComponent {
  const contexts = (Component[Symbol.metadata] as any)._contexts as
    | Map<string, Consumer<any>>
    | undefined;

  if (contexts) {
    const OriginalComponent = Component;

    const contextPropsMap = new WeakMap<object, any>();

    Component = forwardRef((props, ref) => {
      const instanceKey = useState(() => {
        return {};
      });

      let contextProps = contextPropsMap.get(instanceKey);

      if (!contextProps) {
        contextProps = {};
        contextPropsMap.set(instanceKey, contextProps);
      }

      for (const [key, Context] of contexts!) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        contextProps[key] = useContext((Context as any)._context || Context);
      }

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
