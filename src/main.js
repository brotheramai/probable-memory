//will have to change for cordova
//for now I'll just hardcode it
//will probably need to use the import function
var act = {
    modules : {}
}

async function fetchModule(module){
    act.modules[module]= {...(await import(`./modules/${module}/custom.js`))};//the ./ at the beginning is required

    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", `modules/${module}/story.js`);
    xmlhttp.onreadystatechange = function()
    {
        if ((xmlhttp.status == 200) && (xmlhttp.readyState == 4))
        {
            eval(xmlhttp.responseText);
            console.log(storyContent);
            act.modules[module].storyContent = storyContent;
        }
    };
    xmlhttp.send();    
}

fetchModule('test');
fetchModule('test2');

var story;
var current;
function loadStory(module){
    current = act.modules[module];
    story = new inkjs.Story(current.storyContent);
    continueStory();

}

var storyContainer = document.getElementById('story');

function continueStory(){
    var lastTags = [];
    while(story.canContinue){
        var p = document.createElement('p');
        p.innerText = story.Continue();
        lastTags = story.currentTags;
        console.log(lastTags);
        if(lastTags.length > 0){
            processTags(lastTags[0]);
            return;
        }
        storyContainer.appendChild(p);
    }
    if(story.currentChoices.length>0){
        var container = document.createElement('ul');
        container.className='choices';
        story.currentChoices.forEach(c => {
            var b = document.createElement("button");
            b.className='choice';
            b.value = c.text;
            b.innerText = c.text;
            b.setAttribute('data-index',c.index);
            var li = document.createElement('li');
            li.appendChild(b);
            container.appendChild(li);
            b.addEventListener("click",e=>{
                console.log(e);
                story.ChooseChoiceIndex(e.target.getAttribute('data-index'));
                e.target.setAttribute("disabled",true);
                console.log(e.target.closest('.choices'));
                Array.from(e.target.closest('.choices').getElementsByClassName("choice")).forEach(c=>{
                    c.classList.add('not-chosen');
                })
                continueStory();
            });
        });
        storyContainer.append(container);
    }
}
function processTags(tagsraw){
    var command;
    var command_param;
    var action;
    var target;
    (tagsraw => {
        var tags = tagsraw.split(' ');
    
        if(tags.length<1){
            return;
        }
        var params = tags[0].matchAll(/(.*?)\((.*?)\)/g).next();
        if(params.value){
            command = params.value[1];
            command_param = params.value[2];
        }
        else{
            command = tags[0];
        }
        if(tags.length<2){
            return;
        }
        action = tags[1];
        if(tags.length<3){
            return;
        }
        target = tags[2];
    })(tagsraw);
    var action = processAction(action,target);
    switch(command){
        case 'capture':
            if(command_param){
                console.error(`invalid argument ${command_param}, capture takes no arguments`);
                return;
            }
            var i = document.createElement('input');
            i.type='text';
            i.className='capture';
            storyContainer.append(i);
            i.addEventListener('change',(e)=>{
                action(e.target.value)
            });
            return;
        case 'list':
            if(!command_param){
                console.error('list requires an argument');
                return;
            }
            if(!current.variables.hasOwnProperty(command_param)){
                console.error(`could not find variable ${command_param}`);
                return;
            }
            current.variables[command_param].forEach(l=>{
                var b = document.createElement("button");
                b.value = l;
                b.innerText = l;
                b.setAttribute('data-index',0);
                storyContainer.appendChild(b);
                b.addEventListener("click",action);
            });
            return;
        case 'run':
            if(!current.hasOwnProperty(command_param)){
                console.error(`no such function ${command_param}`);
                return
            }
            current[command_param]();
            return;
    }
}
function set(target){
    return (val)=>{
        current.variables[target]=val;
    }
}

function setInk(target){
    return (val)=>{
        story.variablesState[target]=val;
    }
}

function append(target){
    return (val)=>{
        current.variables[target].push(val.target.value);
    }
}
function remove(target){
    return (val)=>{
        current.variables[target].splice(current.variables[target].indexOf(val.target.value),1);
    }
}

function processAction(action, target){
    switch(action){
        case 'set':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for set action`);
                return;
            }
            return set(target);
        case 'set_ink':
            if(story.variablesState[target]==null){
                console.error(`invalid target ${target} for set_ink action`);
                return;
            }
            return setInk(target);
        case 'append':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for append action`);
                return;
            }
            if(!('push' in current.variables[target])){
                console.error(`${target} is not a valid target. append must target a list`);
                return;
            }
            return append(target);
        case 'remove':
            if(!current.variables.hasOwnProperty(target)){
                console.error(`invalid target ${target} for remove action`);
                return;
            }
            if(!('splice' in current.variables[target] &&
                ('indexOf' in current.variables[target]))){
                console.error(`${target} is not a valid target. remove must target a list`);
                return;
            }
            return remove(target);
    }
}