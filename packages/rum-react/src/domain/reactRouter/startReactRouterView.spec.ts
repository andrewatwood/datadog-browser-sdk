import { display } from '@datadog/browser-core'
import {
  createMemoryRouter as createMemoryRouterV6,
  type RouteObject as RouteObjectV6,
  type RouteMatch as RouteMatchV6,
} from 'react-router-dom-6'
import {
  createMemoryRouter as createMemoryRouterV7,
  type RouteObject as RouteObjectV7,
  type RouteMatch as RouteMatchV7,
} from 'react-router-dom'
import { registerCleanupTask } from '../../../../core/test'
import { initializeReactPlugin } from '../../../test/initializeReactPlugin'
import { startReactRouterView, computeViewName } from './startReactRouterView'
import type { AnyRouteMatch } from './types'

const routerVersions = [
  {
    version: 'react-router-6',
    createMemoryRouter: createMemoryRouterV6,
  },
  {
    version: 'react-router-7',
    createMemoryRouter: createMemoryRouterV7,
  },
]

routerVersions.forEach(({ version, createMemoryRouter }) => {
  describe(`startReactRouterView (${version})`, () => {
    describe('startReactRouterView', () => {
      it('creates a new view with the computed view name', () => {
        const startViewSpy = jasmine.createSpy()
        initializeReactPlugin({
          configuration: {
            router: true,
          },
          publicApi: {
            startView: startViewSpy,
          },
        })

        startReactRouterView([
          { route: { path: '/' } },
          { route: { path: 'user' } },
          { route: { path: ':id' } },
        ] as unknown as AnyRouteMatch[])

        expect(startViewSpy).toHaveBeenCalledOnceWith('/user/:id')
      })

      it('displays a warning if the router integration is not enabled', () => {
        const displayWarnSpy = spyOn(display, 'warn')
        initializeReactPlugin({
          configuration: {},
        })

        startReactRouterView([] as unknown as RouteMatchV6[] & RouteMatchV7[])
        expect(displayWarnSpy).toHaveBeenCalledOnceWith(
          '`router: true` is missing from the react plugin configuration, the view will not be tracked.'
        )
      })
    })

    describe('computeViewName', () => {
      it('returns an empty string if there is no route match', () => {
        expect(computeViewName([] as unknown as RouteMatchV6[] & RouteMatchV7[])).toBe('')
      })

      it('ignores routes without a path', () => {
        expect(
          computeViewName([
            { route: { path: '/foo' } },
            { route: {} },
            { route: { path: ':id' } },
          ] as unknown as RouteMatchV6[] & RouteMatchV7[])
        ).toBe('/foo/:id')
      })

      // prettier-ignore
      const cases = [
        // route paths,         path,           expected view name

        // Simple paths
        ['/foo',                '/foo',         '/foo'],
        ['/foo',                '/bar',         '/foo'], // apparently when the path doesn't match any route, React Router returns the last route as a matching route
        ['/foo > bar',          '/foo/bar',     '/foo/bar'],
        ['/foo > bar > :p',     '/foo/bar/1',   '/foo/bar/:p'],
        [':p',                  '/foo',         '/:p'],
        ['/foo/:p',             '/foo/bar',     '/foo/:p'],
        ['/foo > :p',           '/foo/bar',     '/foo/:p'],
        ['/:a/:b',              '/foo/bar',     '/:a/:b'],
        ['/:a > :b',            '/foo/bar',     '/:a/:b'],
        ['/foo-:a',             '/foo-1',       '/foo-:a'],
        ['/foo/ > bar/ > :id/', '/foo/bar/1/',  '/foo/bar/:id/'],
        ['/foo > /foo/bar > /foo/bar/:id',
                                '/foo/bar/1',   '/foo/bar/:id'],

        // Splats
        ['*',                   '/foo/1',       '/foo/1'],
        ['*',                   '/',            '/'],
        ['/foo/*',              '/foo/1',       '/foo/1'],
        ['/foo > *',            '/foo/1',       '/foo/1'],
        ['* > *',               '/foo/1',       '/foo/1'],
        ['* > *',               '/',            '/'],
        ['/foo/* > *',          '/foo/1',       '/foo/1'],
        ['* > foo/*',           '/foo/1',       '/foo/1'],
        ['/foo/* > bar/*',      '/foo/bar/1',   '/foo/bar/1'],
        ['/foo/* > bar',        '/foo/bar',     '/foo/bar'],
        ['/foo/:p > *',         '/foo/bar/baz', '/foo/:p/baz'],
        ['/:p > *',             '/foo/bar/1',   '/:p/bar/1'],
        ['/foo/* > :p',         '/foo/bar',     '/foo/:p'],

        // Extra edge cases - React Router does not provide the matched path in those case
        ['/foo/*/bar',          '/foo/1/bar',   '/foo/*/bar'],
        ['/foo/*-bar',          '/foo/1-bar',   '/foo/*-bar'],
        ['*/*',                 '/foo/1',       '/*/*'],
      ] as const

      cases.forEach(([routePaths, path, expectedViewName]) => {
        it(`returns "${expectedViewName}" for route "${path}" and config "${routePaths}"`, () => {
          // Convert the routePaths representing nested routes paths delimited by ' > ' to an actual
          // react-router route object. Example: '/foo > bar > :p' would be turned into
          // { path: '/foo', children: [{ path: 'bar', children: [{ path: ':p' }] }] }
          const route = routePaths
            .split(' > ')
            .reduceRight(
              (childRoute, routePath) => ({ path: routePath, children: childRoute ? [childRoute] : undefined }),
              undefined as RouteObjectV6 | RouteObjectV7 | undefined
            )!

          const router = createMemoryRouter([route] as any, {
            initialEntries: [path],
          })
          registerCleanupTask(() => router.dispose())
          expect(computeViewName(router.state.matches as any)).toEqual(expectedViewName)
        })
      })
    })
  })
})
