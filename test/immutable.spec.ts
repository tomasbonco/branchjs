import { Patch } from "../../src/libraries/patch";

describe( 'Patch', () =>
{
	describe( '#create', () =>
	{
		it( 'should provide new reference', () =>
		{
			const x: any = { a: 5 };
			const y: any = Patch.create( x );

			y.a = 10;

			expect( x.a ).toBe( 5 );
			expect( y.a ).toBe( 10 );
		})


		it( 'should work on multiple levels', () =>
		{
			const x: any = { a: 5 };
			const y: any = Patch.create( x );
			const z: any = Patch.create( y );

			y.a = 10;
			z.a = 20;

			expect( x.a ).toBe( 5 );
			expect( y.a ).toBe( 10 );
			expect( z.a ).toBe( 20 );
		})

		
		it( 'should work deeply', () =>
		{
			const x: any = { a: { b: 5 } };
			const y: any = Patch.create( x );

			y.a.b = 10;
			y.b = { c: 20 };

			expect( x.a.b ).toBe( 5 );
			expect( x.b ).toBe( undefined );
			expect( y.a.b ).toBe( 10 );
			expect( y.b.c ).toBe( 20 );
		})

		
		it( 'should support Object.assign', () =>
		{
			const x: any = { a: 5, b: 6 };
			const y: any = Patch.create( x );

			delete y.b;
			y.c = 7;

			const z = Object.assign( y );
			const keys = Object.keys( z );

			expect( keys.length ).toBe( 2 );
			expect( z.b ).toBe( undefined );
			expect( z.c ).toBe( 7 );
		})


		it( 'should support adding into Arrays', () =>
		{
			const x: any = { a: [1, 2] };
			const y: any = Patch.create( x );

			y.a.push( 10 );
			y.a.push( 20 );

			expect( x.a.length ).toBe( 2 );
			expect( y.a.length ).toBe( 4 );
			expect( y.a[2] ).toBe( 10 );
		})


		it( 'should return proxies when accessing array', () =>
		{
			const x: any = { a: [ { b: 6 } ] };
			const y: any = Patch.create( x );

			y.a[0].b = 7;
			
			expect( x.a[0].b ).toBe( 6 );
			expect( y.a[0].b ).toBe( 7 );
		})
	})


	describe( '#isPatch', () =>
	{
		it( 'should return true when target is patch', () =>
		{
			const x: any = { a: 5 };
			const y: any = Patch.create( x );

			expect( Patch.isPatch( x ) ).toBe( false );
			expect( Patch.isPatch( y ) ).toBe( true );
		})
	})


	describe( '#freeze', () =>
	{
		it( 'should do a shallow freeze without deep param', () =>
		{
			const x: any = { a: 5, b: { c: 6 } };
			const y: any = Patch.create( x );

			Patch.freeze( y );

			expect( Patch.isFrozen( y ) ).toBe( true );
			expect( Patch.isFrozen( y.b ) ).toBe( false );
			
			// Proof that first level is frozen
			y.c = 10;
			expect( y.c ).toBe( undefined );

			// Proof that second level is not frozen
			y.b.a = 2;
			expect( y.b.a ).toBe( 2 );
		})


		it( 'should do a deep copy, once parameter is set', () => 
		{
			const x: any = { a: 5, b: { c: 6 } };
			const y: any = Patch.create( x );

			Patch.freeze( y, true );

			expect( Patch.isFrozen( y ) ).toBe( true );
			expect( Patch.isFrozen( y.b ) ).toBe( true );

			// Proof that first level is frozen
			y.c = 10;
			expect( y.c ).toBe( undefined );

			// Proof that second level is frozen as well
			y.b.a = 2;
			expect( y.b.a ).toBe( undefined );
		})
	})


	describe( '#equals', () =>
	{
		it( 'should return true, when one object is made from another and has not changed', () =>
		{
			const x: any = { a: { b: 6 }, c: [ 2, 5 ] };
			const y: any = Patch.create( x );

			expect( x.a ).not.toBe( y.a );
			expect( Patch.equals( x.a, y.a ) ).toBe( true );

			expect( x.c ).not.toBe( y.c );
			expect( Patch.equals( x.c, y.c ) ).toBe( true );

			y.a.b = 7;
			y.c.push( 3 );
			
			expect( Patch.equals( x.a, y.a ) ).toBe( false );
			expect( Patch.equals( x.c, y.c ) ).toBe( false );
		})	
	})


	describe( '#hasChanged', () => 
	{
		it( 'should report true, when something has changed on first level', () =>
		{
			const x: any = { a: 5 };
			const y: any = Patch.create( x );

			expect( Patch.hasChanged( y ) ).toBe( false );
			
			y.a = 6;

			expect( Patch.hasChanged( y ) ).toBe( true );
		})


		it( 'should report when something somewhere has changed', () =>
		{
			const x: any = { a: 5, b: [ { c : 6 } ] };
			const y: any = Patch.create( x );

			expect( Patch.hasChanged( y ) ).toBe( false );
			
			y.b[0].c = 7;
			
			expect( Patch.hasChanged( y ) ).toBe( true );
		})
	})
})