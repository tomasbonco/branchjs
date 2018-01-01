# Patch.js

Brings all benefits of immutable structures without the pain of immutable structures.

## Motivation 

You were told that immutable structures are the way to go. But you have to rebuild whole state every time you do a change. That's a lot of pain. Using getters to access values in object? Or specifing whole tree as an array of strings to specify what to change? Not only it's stupid, it also protects code intelisence from finding errors there. There must be a better way.

Let's get back to the beginning. You probably don't really want immutable data structures. You want a realiable state, a source of truth. And ideally you don't want it to be mutable. But does it mean it has to be immutable (frozen)? If you had `getState()` function in a store and it would always return a new copy of the state, wouldn't it solve your problem? Then your code may mutate it's own copy and once you're happy with it you can announce it as new state using `setState()`. So what you gain so far? You have a source of truth, because you can't access it (only its copies) you can't mutate it, you are free to do mutations on your copy as you like with the whole power of Javascript and you can even time travel!

So let's talk about performance now. Doing a copy every time you ask for a state is an consuming operation. Doing conversion from Immutable to Mutable and back to Immutable, would be more consuming but there is a better way. You can create a Proxy instead of making copy. That means new reference without copying. Super fast. That's what Patch.js does and a little more.

## Example you are used to see

```
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
		return Patch.create( this.state ); // returns new reference without copying
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

```
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

// Patch.js
feedAnimals( territoryId )
{
    const zoo = store.getState(); // or pass store state as parameter
    const isMammal = animal => animal.isMammal;
    zoo.territories[ territoryId ].animals.filter( isMammal ).forEach( mammal => mammal.lastFeeded = (new Date()).getTime() );
    
    store.setState( zoo ); // or return
}
```

## So what's the difference to immer?

Well, I like immer, even though I never used it. It is more conceptual thing. With immer and other libraries, you are solving the problem on state-creation part. Patch.js is solving the problem in a store in getState() method. So you almost never use it, yet it provides all the magic. Compare that with Immutable.js!