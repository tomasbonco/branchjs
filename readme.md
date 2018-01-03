# Branch.js

Brings all benefits of immutable structures without the pain of immutable structures.

## Motivation 

You are being told that immutable structures are the way to go. And then you find out you have to rebuild the whole state every time you do a change. That's a lot of pain. Then you find out other bonuses like using getters to access values in an object. Or specifying what you want to change as an array of strings. Not only it's stupid, it also protects code intellisense from finding errors there. Have you ever been thinking that there must be a better way?

Let's get back to the beginning. You most likely don't need immutable data structures. You want a reliable state, a source of truth. And you don't want it to be mutable. But does it mean it has to be immutable (frozen)? If you had `getState()` function in a store and it would always return a new copy of the state, wouldn't it solve your problem? Then your code (probably reducer) may mutate its own copy of the state and once you're happy with it you can announce it as the new state using `setState()`. So what you gain so far? You have a source of truth. Because you can't access it (only its copies) you can't mutate it. You are free to do mutations on your copy as you like with the whole power of Javascript and you can even time travel! Sounds interesting?

So let's talk about performance now. Doing a copy every time you ask for a state is a consuming operation. Well, doing the conversion from Immutable to Mutable and back would be even more consuming (depends on how is your app written) but there is a better way. You can create a Proxy instead of making a copy. That means you can get the new reference without copying. Super fast. That's what Branch.js does and a little more.

## Example you are used to see

```javascript
export class Example
{
	state;

	constructor()
	{
		this.setState( { value: 0 } );
	}

	setState( value )
	{
		this.state = value;
	}

	getState(): { value: number }
	{
		return Branch.create( this.state ); // returns new reference without copying
	}

	increment()
	{
		const state = this.getState();
		state.value++;
		this.setState( state );
	}

	decrement()
	{
		const state = this.getState();
		state.value--;
		this.setState( state );
	}
}
```

## Better example

```javascript
// Seamless-Immutable, because it's cooler than Immutable.js
feedMammals( state, territoryId ) // reducer
{
    const zoo = state;
    const territories = zoo.territories;
    const isMammal = animal => animal.isMammal;

    const feedAnimals = zoo.territories[ territoryId ].animals.map( animal =>
    {
        if ( isMammal( animal ) )
        {
            return Immutable.set( animal, 'lastFeeded', (new Date()).getTime() );
        }

        return animal;
    })

    const newTerritory = Immutable.set( territories[ territoryId ], 'animals', feededAnimals );
    const newTerritories = [ ...territories.splice(0, territoryId), newTerritory, ...territories.splice( territoryId + 1 ) ];
    const newZoo = Immutable.set( zoo, 'territories', newTerritories );

    return newZoo;
}

// Branch.js
feedAnimals( territoryId )
{
    const zoo = store.getState(); // or pass store state as parameter
    const isMammal = animal => animal.isMammal;
    zoo.territories[ territoryId ].animals.filter( isMammal ).forEach( mammal => mammal.lastFeeded = (new Date()).getTime() );
    
    store.setState( zoo ); // or return
}
```

## API

### create( target: Object|Array )

Creates a new branch of data.

```javascript
const newState = Branch.create( oldState );
```


## isBranch( target: any )

Returns true, if target was created by Branch.js.

```javascript
const x = { a: 5 };
const y = Branch.create( x );

console.log( Branch.isBranch( x ) ); // false
console.log( Branch.isBranch( y ) ); // true
```

## freeze( target: Branch, deep: boolean = false)

Freeze object, if you feel like you need it. It works on proxy level and it bans mutating an object.

```javascript
const state = Branch.create({ x: 5 });
Branch.freeze( state );

state.x = 10;
console.log( state.x ); // 5
```

## isFrozen( target: any )

Returns true, if target is ~~a Disney movie~~ frozen. **It returns false, if object was frozen by Object.freeze(), because it wasn't frozen by Branch.freeze().**

```javascript
const state = Branch.create({ x: 5 });
Branch.freeze( state );

console.log( Branch.isFrozen( state ) ); // true
```

## isDirty( target: any )

Retuns true, if there were made some changes, since object was created. If you want a deep version look at `hasChanged` method.

```javascript
const state = Branch.create({ a: 5 });

state.y = 10;
Branch.isDirty( state ); // true
```

## equals( target: any, target2: any )

This returns true, if both targets are based on the same state and they haven't changed. It doesn't deeply compare objects. Hopefully example will be super clear.

```javascript
const data = { x: 5 };
const state1 = Branch.create( data );
const state2 = Branch.create( data );

Branch.isEqual( data, state1 ); // true
Branch.isEqual( state1, state1 ); // true

// Compare modified state
state2.y = 10;
Branch.isEqual( state1, state2 ); // false, because state2 has mutated

// Compare same content
const data2 = { x: 5 };
Branch.isEqual( data2, state1 ); // false, because state1 is based on data1
```

## hasChanged( target: Object )

Returns true, if something has changed even deeply in Branch.

```javascript
const state = BRanch.create({ firstLevel: { secondLevel: 10 } });
state.firstLevel.secondLevel = 20;

Branch.hasChanged( state ); // true
Branch.hasChanged( state.firstLevel ); // true
```