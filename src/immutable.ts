const FROZEN_FLAG = Symbol( 'patch-frozen' );
const IMMUTABLE_FLAG = Symbol( 'patch' );
const DIRTY_FLAG = Symbol( 'patch-dirty' );
const EQUALS_FLAG = Symbol( 'patch-equals' );

export class Patch
{
	static create( target: Object )
    {
        if ( target !== Object( target ) )
        {
            return target;
        }

        if ( Array.isArray( target ) )
        {
            return new Proxy( target, new ArrayProxy( target ) );
        }
        
        return new Proxy( target, new ObjectProxy() );
    }


    static isPatch( target )
    {
		if ( target !== Object( target ) )
		{
			return false;
		}

        return !! target[ IMMUTABLE_FLAG ];
    }


    static freeze( target: Object, deep: boolean = false ): void
    {
		if ( target !== Object( target ) )
		{
			console.error( 'Non-objects cant be frozen!' );
			return;
		}

		target[ FROZEN_FLAG ] = true;
		
		if ( deep )
		{
			Object.keys( target ).forEach( key =>
			{
				if ( Patch.isPatch( target[ key ] ) )
				{
					Patch.freeze( target[ key ], deep );
				}
			})
		}
    }


    static isFrozen( target: Object ): boolean
    {
		if ( target !== Object( target ) )
		{
			return false;
		}

        return target[ FROZEN_FLAG ];
	}


	static isDirty( target: Object ): boolean
	{
		if ( target !== Object( target ) )
		{
			return false;
		}

        return target[ DIRTY_FLAG ];
	}
	

	static equals( obj1: any, obj2: any ): boolean
	{
		const real1 = Patch.isPatch( obj1 ) ? obj1[ EQUALS_FLAG ] : obj1;
		const real2 = Patch.isPatch( obj2 ) ? obj2[ EQUALS_FLAG ] : obj2;

		return real1 === real2;
	}


	static hasChanged( target: Object )
	{
		if ( ! Patch.isPatch( target ) )
		{
			return false;
		}

		if ( Patch.isDirty( target ) )
		{
			return true;
		}

		for ( const key in target )
		{
			if ( Patch.hasChanged( target[ key ] ) )
			{
				return true;
			}
		}

		return false;
	}
}

export class ObjectProxy implements ProxyHandler<any>
{
	private overrides = {};
	private deleted: Set<PropertyKey> = new Set<PropertyKey>();
	private isFrozen: boolean = false;
	private isDirty: boolean = false;


	defineProperty( target: Object, property: PropertyKey, descriptor: PropertyDescriptor ): boolean
	{
		if ( this.isFrozen )
		{
			console.error( 'Cannot define property to frozen object!' );
			return false;
		}

		this.isDirty = true;
		this.deleted.delete( property );

		return this.overrideTo( property, undefined, descriptor );
	}


    set( target: Object, property: PropertyKey, value: any ): boolean
    {
        if ( this.isFrozen )
        {
            return true;
        }

        if ( property === FROZEN_FLAG )
        {
			this.isFrozen = true;
			return true;
		}
		

        if ( target[ property ] === value )
        {
            // ignore, if there is no change
            return true;
        }

        if ( value === Object( value ) )
        {
            value = Patch.create( value );
        }

		return this.defineProperty( target, property, { writable: true, configurable: true, enumerable: true, value } );
    }


    has( target: Object, property: PropertyKey ): boolean
    {
		if ( this.deleted.has( property ))
		{
			return false;
		}

        if ( this.isOverriden( property ))
        {
            return true;
        }

        return target.hasOwnProperty( property );
    }


    get( target: Object, property: PropertyKey, receiver: any ): any
    {
        if ( property === FROZEN_FLAG )
        {
            return this.isFrozen;
        }

        if ( property === IMMUTABLE_FLAG )
        {
            return true;
		}
		
		if ( property === DIRTY_FLAG )
		{
			return this.isDirty;
		}

		if ( property === EQUALS_FLAG )
		{
			return this.isDirty ? this : target;
		}


		if ( this.deleted.has( property ) )
		{
			return undefined;
		}

        if ( this.isOverriden( property ) )
        {
            return this.overrides[ property ];
		}
        

        const value = target[ property ];

        if ( value === Object( value ) && Object.getOwnPropertyDescriptor( target, property ).configurable === true )
        {
			const proxied = Patch.create( value );
            this.overrideTo( property, proxied );
            return proxied;
        }

        return Reflect.get(target, property, receiver);
	}
	

	deleteProperty( target: Object, property: PropertyKey ): boolean
	{
		if ( this.isFrozen )
		{
			console.error( 'Cannot delete property from frozen object!' );
			return false;
		}

		this.isDirty = true;
		this.overrideTo( property, undefined );
		this.deleted.add( property );

		return true;
	}


	ownKeys( target: Object ): PropertyKey[]
	{
		const originalKeys: PropertyKey[] = Object.keys( target );
		const overridenKeys: PropertyKey[] = Object.keys( this.overrides );
		const possibleKeys: PropertyKey[] = originalKeys.concat( overridenKeys );
		const keys: PropertyKey[] = possibleKeys.filter( key => ! this.deleted.has( key ) );

		return keys;
	}


	getOwnPropertyDescriptor( target: Object, property: PropertyKey ): PropertyDescriptor | undefined
	{
		if ( this.deleted.has( property ))
		{
			return undefined;
		}

		if ( this.isOverriden( property ))
		{
			return Object.getOwnPropertyDescriptor( this.overrides, property );
		}

		return Object.getOwnPropertyDescriptor( target, property );
	}
	

	private isOverriden( property )
	{
		return this.overrides.hasOwnProperty( property );
	}


	private overrideTo( property: PropertyKey, value: any, descriptor?: PropertyDescriptor )
	{
		if ( ! descriptor )
		{
			descriptor = { enumerable: true, configurable: true, writable: true, value } as PropertyDescriptor
		}

		return Object.defineProperty( this.overrides, property, descriptor );
	}
}


class ArrayProxy implements ProxyHandler<any>
{
	private isFrozen: boolean = false;
	private isDirty: boolean = false;

	private copy: any[];
	private MUTABLE_METHODS: PropertyKey[] = [ 'splice', 'push', 'pop', 'shift', 'unshift', 'sort' ];


	constructor( target: any[] )
	{
		this.copy = target.map( x => Patch.create( x ) );
	}


	defineProperty( target: Object, property: PropertyKey, descriptor: PropertyDescriptor )
	{
		if ( this.isFrozen )
		{
			console.error( 'Cannot define property to frozen object!' );
			return false;
		}

		this.isDirty = true;
		return Reflect.defineProperty( this.copy, property, descriptor );
	}


	set( target: Object, property: PropertyKey, value: any, receiver: any )
	{
		if ( this.isFrozen && this.MUTABLE_METHODS.includes( property ) )
		{
			console.error( 'Cannot define property to frozen object!' );
			return true;
		}

		this.isDirty = true;
		return Reflect.set( this.copy, property, value, receiver );
	}


	has( target: Object, property: PropertyKey )
	{
		return Reflect.has( target, property );
	}


	get( target: Object, property: PropertyKey, receiver: any ): any
    {
        if ( property === FROZEN_FLAG )
        {
            return this.isFrozen;
        }

        if ( property === IMMUTABLE_FLAG )
        {
            return true;
		}
		
		if ( property === DIRTY_FLAG )
		{
			return this.isDirty;
		}

		if ( property === EQUALS_FLAG )
		{
			return this.isDirty ? this : target;
		}

		return Reflect.get( this.copy, property, receiver );
	}


	ownKeys()
	{
		return Reflect.ownKeys( this.copy );
	}


	deleteProperty( target: Object, property: PropertyKey )
	{
		return Reflect.deleteProperty( this.copy, property );
	}


	getOwnPropertyDescriptor( target: Object, property: PropertyKey )
	{
		return Reflect.getOwnPropertyDescriptor( this.copy, property );
	}
}