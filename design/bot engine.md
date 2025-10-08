# Bots - How do they work?
The bots are based on [inkjs](https://github.com/y-lohse/inkjs), an excellent javascript port of the lovely [ink](https://www.inklestudios.com/ink/) language from the good folks at [inkle](https://www.inklestudios.com).

Ink is a story engine that is used primarily for making conversations in video games. Since the bots are really just conversations with yourself it's a natural fit.

# The bot lifecycle.
All a bot does is progress the ink story until user interaction is required, wait until the user is finished, and then resume the story. 

User interaction happens when the story presents dialog choices. For more information see [writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).

User interaction can also happen when the bot encounters certain commands. Commands are how we get bots to do things that ink cannot do for us.

# Commands
If a line of ink starts with `>` then it is processed as a command.

Commands have the form:
`> command(param1, param2)`

| command | description | parameters | pauses the story |
| ------------- | ----------- | ---------------- | ---------------- |
| capture       | Produces a text input for capturing user responses | Writes the captured value to the name of the ink variable that is passed, or _input if nothing is passed. | yes |
| list          | Produces choices based on a list| The first parameter specifies which list to display. The second parameter determines where to save the selected value, _input is used if nothing is passed. | yes |
| createList    | Creates a list | The name of the list to be created. | no |

**Note:** If you want to use _input outside of a command (e.g. to show its value) put this at the top of your story:
```
VAR _input = ""
```
This defines _input as a global variable, allowing you to reference it like any other variables you have defined.
### Examples

```
> createList(priorities)
```
Creates a new list named priorities.

```
> capture() 
> append(priorities,_input)
```
Presents a text box and adds the user's response to the priorities list.

```
> list(priorities)
> remove(priorities,_input)
```
Presents the list of priorities to the user and removes the selected priority.