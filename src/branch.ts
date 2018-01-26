const FROZEN_FLAG = Symbol( 'branch-frozen' );
const IMMUTABLE_FLAG = Symbol( 'branch' );
const DIRTY_FLAG = Symbol( 'branch-dirty' );
const EQUALS_FLAG = Symbol( 'branch-equals' );

export class Branch
{
	/**
	 * Creates new proxy over object and that's why returns a new reference.
	 * @param {Object} target - state that you want to "copy"
	 * @returns {Object-like} new branch of state
	 */
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

        return new Proxy( Object.create( target ), new ObjectProxy() );
    }


	/**
	 * Returns true, if target was created using Branch.js
	 * @param {any} target - target to be checked
	 */
    static isBranch( target: any )
    {
		if ( target !== Object( target ) )
		{
			return false;
		}

        return !! target[ IMMUTABLE_FLAG ];
    }


	/**
	 * Once freezed, object won't accept any changes.
	 * @param {Object} target - branch to be frozen
	 * @param {boolean} deep 
	 */
    static freeze( target: Object, deep: boolean = false ): void
    {
		if ( ! Branch.isBranch( target ) )
		{
			console.error( `Non-branch objects can't be frozen!` );
			return;
		}

		target[ FROZEN_FLAG ] = true;

		if ( deep )
		{
			Object.keys( target ).forEach( key =>
			{
				if ( Branch.isBranch( target[ key ] ) )
				{
					Branch.freeze( target[ key ], deep );
				}
			})
		}
    }


	/**
	 * Returns true, if object is frozen.
	 * @param {Object} target - target to be checked
	 * @returns {boolean} - true, if object is frozen
	 */
    static isFrozen( target: any ): boolean
    {
		if ( ! Branch.isBranch( target ) )
		{
			return false;
		}

        return target[ FROZEN_FLAG ];
	}


	/**
	 * Returns true, if there were some changes done to object.
	 * @param {Object} target - target to be checked
	 * @returns {boolean} - true, if there were some changes done to object
	 */
	static isDirty( target: any ): boolean
	{
		if ( ! Branch.isBranch( target ) )
		{
			return false;
		}

        return target[ DIRTY_FLAG ];
	}


	/**
	 * Returns true, if both params are based on same state and they don't have changes.
	 * @param {any} obj1 - first object
	 * @param {any} obj2 - second object
	 * @returns {boolean} - true, if both parameters are based on same state and they don't have changes
	 */
	static equals( obj1: any, obj2: any ): boolean
	{
		const real1 = Branch.isBranch( obj1 ) ? obj1[ EQUALS_FLAG ] : obj1;
		const real2 = Branch.isBranch( obj2 ) ? obj2[ EQUALS_FLAG ] : obj2;

		return real1 === real2;
	}


	/**
	 * Returns true, if something has changed in target since it was created (works deeply).
	 * @param {Object} target - target to be checked
	 * @returns {boolean} true, if target has change since it was created
	 */
	static hasChanged( target: Object ): boolean
	{
		if ( ! Branch.isBranch( target ) )
		{
			return undefined;
		}

		if ( Branch.isDirty( target ) )
		{
			return true;
		}

		for ( const key in target )
		{
			if ( Branch.hasChanged( target[ key ] ) )
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

		// You cannot create non-configurable property on proxy, if it is not present on target object.
		// That's why we do Object.create(), so we can actually create this property, without altering original object.
		if ( descriptor.configurable === false )
		{
			Object.defineProperty( target, property, descriptor );
		}

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

        return target['__proto__'].hasOwnProperty( property );
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
			return this.isDirty ? this : target['__proto__'];
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

        if ( value === Object( value ) && target['__proto__'].hasOwnProperty( property ) && Object.getOwnPropertyDescriptor( target['__proto__'], property ).configurable === true )
        {
			const proxied = Branch.create( value );
            this.overrideTo( property, proxied );
            return proxied;
        }

        return Reflect.get( target['__proto__'], property, receiver );
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
		const originalKeys: PropertyKey[] = Reflect.ownKeys( target['__proto__'] );
		const overridenKeys: PropertyKey[] = Reflect.ownKeys( this.overrides );
		const possibleKeys: PropertyKey[] = originalKeys.concat( overridenKeys );
		const keys: PropertyKey[] = possibleKeys.filter( key => ! this.deleted.has( key ) );
		const uniqueKeys = Array.from( new Set( keys ));

		return uniqueKeys;
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

		return Object.getOwnPropertyDescriptor( target['__proto__'], property );
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
		this.copy = target.map( x => Branch.create( x ) );
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
		if ( this.isFrozen && this.MUTABLE_METHODS.indexOf( property ) >= 0 )
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