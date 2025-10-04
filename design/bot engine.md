# Bots - How do they work?
The bots are based on [inkjs](https://github.com/y-lohse/inkjs), an excellent javascript port of the lovely [ink](https://www.inklestudios.com/ink/) language from the good folks at [inkle](https://www.inklestudios.com).

Ink is a story engine that is used primarily for making conversations in video games. Since the bots are really just conversations with yourself it's a natural fit.

# The bot lifecycle.
All a bot does is progress the ink story until user interaction is required, wait until the user is finished, and then resume the story. 

User interaction happens when the story presents dialog choices. For more information see [writing with ink](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md).

User interaction can also happen when the bot encounters certain tags. Tags are how we get bots to do things that ink cannot do for us.

# Tags
There are two kinds of tags: value tags, and control tags.

Value tags are used to create, collect, or modify a value and then do something with it.

Command tags are used to send a special command to the bot.

## Value tags
Value tags have the form:
`!# value_command(param) action target`

Where the value_command instructs the bot where the value will come from, the action tells the bot what to do with the value, and the target tells the bot what the action should affect.
Some value commands accept a param which changes the effect of the command.

### value_command

| value_command | description | parameter effect | pauses the story |
| ------------- | ----------- | ---------------- | ---------------- |
| capture       | Produces a text input for capturing user responses | Parameters are not allowed | yes |
| list          | Produces a set of options based on a list| Determines which list is displayed, this parameter is required | yes |
| lval          | Produces an empty list | Parameters are not allowed | no |
| val           | Produces an empty value | If a parameter is provided the parameter is produced as the value instead | no |

### action

| action | description |
| ------ | ----------- 
| create | Creates a new target with the value supplied |
| set    | Updates the target with the value supplied |
| set_ink | Updates the target ink variable with the value supplied |
| append | Adds the value supplied to the target list |
| remove | Removes the value supplied from the target list |

### target

Targets are created using the create action, or are defined in ink as global variables.

### Examples

`!# lval() create priorities`
Creates a new target list named priorities.

`!# capture append priorities`
Presents a text box and adds the user's response to the priorities list.

`!# list(priorities) set_ink priority`
Presents the list of priorities to the user and saves the selected priority into an ink variable named priority.

## Command tags
Command tags are invoked directly

| command | description |
| ------- | ----------- |
| save    | Saves the conversation for the future, all targets will be saved as well |

## How to use tags - the simple way
To use a tag simply add a line that starts with !# and then write your tag.
```
Sample text in an ink story
!# this will be interpreted as a tag
another line of text in the story
```

## How to use tags - the messy truth
Tags in ink are intended to be used to provide additional, computer-only information *alongside* text that is displayed to the user. From ink's point of view all tags *belong* to a line of text. 

In fact, if a tag is supplied with no attached text ink will automagically attach that tag to the text that comes *after* the tag! If multiple tags are defined and none of them have text attached they will **all** be assigned to the next bit of text that gets printed, even if that text is after a divert!
 
Worse, ink does not make tags visible to a bot until the text that the tag belongs to is reached in the story, meaning that the only way to control when a tag is processed is to modify the text of the story.

To solve this problem bots *do not print* the text that a tag belongs to. This allows attaching dummy text to every tag without effectively changing the text or flow of the story itself. With this in mind look at "the simple way" again.

```
!# this will be interpreted as a tag
```
Really ink interprets this as an ! on a line by itself with an attached tag. Since bots don't print tagged text the ! is not shown to the user and no one is the wiser.

Now that you understand a bit more about how tags are handled there a few advanced tagging techniques that you can make use of.

### Alternatives to !
Since the text before # is not displayed to the user you do not *have* to use an !, for example: `commit # save`

Keep in mind, if you want to add comments to your story ink supports comments via // and /* */. 

### Omitting parenthesis
If you are not providing a param to a value_command you may omit the parenthesis. For example `!# val() create priority` and `!# val create priority` are equivalent.

### Grouping tags
Multiple tags can be provided on a single line if they are separated by commas.
`!# val() create main_priority, lval() create priorities`
This can be useful for keeping certain tags together.

If multiple lines of tags are provided in a row only the final line needs to have an !
```
# lval() create priorities
# val(a) append priorities
# val(b) append priorities
# val(c) append priorities
!# val() create priority
```

Since an empty tag is completely valid you can even put the owning text on its own line
```
# lval() create priorities
# val(a) append priorities
# val(b) append priorities
# val(c) append priorities
# val() create priority
!#
```
This allows you to move tags around freely without having to change which one has the !

If you like you can even make blocks of tags for visual clarity
```
!#
# lval() create priorities
# val(a) append priorities
# val(b) append priorities
# val(c) append priorities
# val() create priority
!#
```

### Whitespace 
When ink provides tags to a bot it removes all extra spaces, so you can space things out readability without compromising functionality.
```
!#
 # lval() create priorities
 #     val(Bob)     append priorities
 #     val(Alice)   append priorities
 #     val(Cecilia) append priorities
 #
 # val() create priority
!#
```
**Note** You cannot put a space anywhere inside of `value_command(param)`.

### Grouping user interaction tags
If you include a tag that provides user input in a group of tags you won't be able to access the user input in the other tags in the group. 

For example:
```
!# capture set_ink opinion, save
```
will not save the new value of opinion. This is because the save command is processed immediately after the text prompt is displayed; it does not wait until the user response has been captured and the set_ink action has been processed. 

Splitting the tags onto different lines:
```
# capture set_ink opinion
!# save
```
will not work either. Since both tags are owned by the ! on the second line, save will be processed as soon as the text prompt is displayed. 

Providing owning text for each:
```
!# capture set_ink opinion
!# save
```
works as expected and not coincidentally is exactly what "the simple way" suggests.