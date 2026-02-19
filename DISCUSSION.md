# Discussion

Good Morning Jamie,
I hope you're well and having a great week.

Please find enclosed the following:
- The artifact itself
- The Claude exports and conversations (all MD format) 
- This file which adds commentary to the Claude conversation

---

## Artifact

The artifact isn't a CMS or a Web Scraper (though, 
I did build one for a client on Tuesday, using augmented AI, and you're welcome to see it), 
it's a simple Web Component that builds a To Do list.  
Why? Well, they're simple, relatable, and do-able in a short period of time, and not actually
the principle part of this test.
But, armed with that, they can be almost infinitely expandable, which we'll see during the 
Claude conversation - which **is** the test.

---

## Claude - and our Pair Programming Session

I treat Claude like another developer. Someone full of youthful exuberance and a willingness
to help me complete tasks.    
My current set up for developing (which has changed more recently) consists of a number of 
screens. Left is the browser pane, right is the sundries (CLI, Docker Desktop, WSL2 Terminal, 
Slack, etc.), and centre has always been the IDE (I use PHPStorm).
As my AI augmented coding journey has developed, for the first time ever, my IDE now sits right,
and the Terminal, LM Studio and sundry connections sit central. That's how important and 
frequently I'm using Claude.  

I tend to pick a working folder, start `tmux` and run a full-length vertical pane. To the right
I have two panes split vertically. Top is for the runner or daemon (NodeJS, etc.), and the 
lower for any commands I need to run, or committing, pushing from there.  
The tall vertical pane is for Claude.  
I'm presently running Claude Code Max, which genuinely **is** worth every penny. And I run 
several smaller LLM's on my local Workstation and the home server for smaller atomic tasks.  
I will always start in `Plan Mode` (Opus 4.6), and as of yesterday, running tasks, agents and 
skills use Sonnet 4.6, or Haiku for the simpler efforts.  
I'm very specific on the task bar, token usage, current working folder and being as efficient
as possible. This might seem obvious, but it's well worth noting.

So, that's the setup I use, and used for this task. I'm happy to discuss should we get to
a call.

---

## Claude - Conversation

I mentioned earlier that there are a number of `jsonl` and `MD` files in the GitHub 
repository which provide complete reference to the task. This is a digest of **actual**
prompts I used. The conversations are subject to the automatic **compact** efforts
Claude uses in order to keep the context relevant and short. I know you know this. :)

So, I started off, clean folder, nothing in at all, set my `tmux` and started.

```plantuml
Create a small proof-of-concept for a web component that needs to be holistic, reusable and agnostic.
This will be a frontend based component only. Any data will currently be stored locally (localStorage) and will be held in a JSON model based format. This may change in future, ergo, we will use models and fields conducive to the better known backend systems such as
Symfony/Laravel, etc. The localStorage should be in a separate class, use name spacing for data.

We will make a to do list as a web component.
- Add a .env file for mutable configuration options for the project.
- Add a todo.config.json file for run-time configuration options

Details to be stored will be as follows:
- List item detail (detail)
- Task assigned to (owner), just a text field for now, we'll revise later, or, if non-configured, we can ignore
- Current status (Not yet commenced, in progress, in review, complete plus any suggestions you can think of!), these are likely to live as immutables, suggestions and acronyms are welcomed.
- Date of addition (added_at)
- Date of last change (amended_at)
- Date of completion (completed_at)
- Advise on potential other fields

We need ensure that we use Models for storage and further work.
We will need to be able to run on Node for development so run npm init, install live server, populate a package.json with runtime detail for roll-up and testing.
Keep assets separate. I expect a HTML/CSS and JS to be in their own files, and, suggest a method for roll-up.
I'd like to use Playwright for testing; advise on this.

This is a zero dependency artifact, possible with exception of the UI, so all code must be brand new.
For the UI, have a toggle icon to make the component appear in-line.
We can work on the look and feel. For now, take influence from TailwindCSS.
I'd also like an opinion on the difficulty of possibly using DommaJS for the interface.

Thinkultrahard, advise, self-audit, ask questions when needed.
```

Yes, it's a simple To Do Web Component. It's short, do-able and kind-of finite, re-usable 
for a short task, and it means that this file is _relatively_ short.  
I opted to tell Claude that I want to use localStorage - two reasons. Simplicity 
and completeness.

I add `.env` files, and `config.json` or `config.php` files to everything where run-time
data can be extricated. 

I'm specific here about how I want the data and structure to be, and that's very deliberate. You'll
see later that I'm open to Claude's interpretation of structure and advisories, but this, where
the data is paramount and may also be used in conjunction with a back-end for permanent storage
I am strict, (as this is an exercise, so, you'll see why in a little bit) but I also hand Claude
the field names. Now, Claude would've worked this out regardless. I mention earlier in the 
prompt that there may be an eventual coupling with a backend, Laravel or Symfony, so, I'm pushing
their conventions here. This will also save think time and tokens. The more specific here, the
better.  
The data itself is straight-forward, and when adding owner, Claude **will** understand that `owner`
will likely be a foreign key at some point, so I ease its mind by simplifying it as a text string.
I add statuses, but don't give any enumerative values. I don't need them. Claude will understand
this prompt and forge them by itself. Lazy? Yes! Useful? Yes!

I'm insistent here too on Model usage. It's important to convey to Claude that this isn't a 
playground, and we want safe and structured code that's ultimately human-readable.
Whilst it may be unlikely, we still need that going forward. 
I also insist on the file type being kept separate before roll-up. Certain framework based 
components are different, such as Livewire components and Vue components, but for legibility,
I opted for separate. Note, everything I prompt is deliberate, even when asking for advice. 

I advise that we need to be able to execute the artifact and test it. I state `npm` and `live 
server`, edit the `package.json` with run-time commands. This simplifies everything.
I ask that Claude use Playwright for testing (this is so useful), though I will take advice on this.
Asking advice is important. Models that use tooling, such as Claude have the ability to web scrape 
data and then go away and cogitate before offering an alternative. This is infinitely useful.

I then state it should be zero-dependency. Two reasons, one, it's clean and holistic, and two, this
is an exercise and forum to be cavalier. I also then deliberately ask for everything to be brand new.
Claude has decisions to make here. I'm being almost deliberately contradictory. I want a TailwindCSS
style of outcome, but, don't use it. I ask Claude to look at the DommaJS framework for some
inspiration, possible use, and that's not me plugging my own framework, it's to show that Claude
can and will make decisions based on what's best and keeping the project small and simple.

Finally, the `Thinkultrahard` line. That bit, I did not need as we're in plan mode, and using Opus 4.6
for this part regardless.   
The self-audit, ask questions when needed are assistive for Claude. If you tell Claude to make good 
choices, it will.

So the initial build takes place. Claude sets up several agents (we've none currently and no skills) 
and does it's work. 

I know this will take some time (around 7m I think it was), I'm using that time to ensure that we have
something usable and complete.
I add in the following;
```plantuml
btw, ensure that we can amend the status and description of any task
```
Claude won't stop what it's doing, but, will bear this in mind and weave it in when it can.

I then push the DommaJS question;

```plantuml
btw Are we opting to use Domma?
```
Claude responds to this by telling me a pretty hard no. Adding in a framework here is akin to using
a pile-driver to crack a walnut.

By this point we had a semi-working and almost complete task.

**All of the responses from Claude, advancement, etc. are in the MD files in the repository**

The statuses of the added tasks weren't amendable, nor was the task description.   
Claude also decided to include not one but two stylistically different components - cute.  
The trigger icon I asked for was an "eye" making the component collapsible, again, good work from
Claude on this.
Possibly the best part of all was the audit. You'll notice I never explicitly ask for an audit.

Now Claude understands there's likely going to be some test/debug work, and adds it anyway - even if
the only entity to entertain or use it is Claude. Great work!  

```plantuml
Please run the tests; self-check as we have several small issues.

  - After the addition of a task, it isn't possible to amend the status of a task. Thinkhard, self-test and run Playwright tests for this.
  - Status is a requirement when adding a new task. Do not restrict the owner to the addition of a test unstarted.
```

The small issues were that - small. Having Claude self-audit and test is paramount.  
In a small component such as this, testing is mostly visual. In large components and projects, it's 
imperative to get these right from the start. Good tests equals solid code.

```plantuml
I'm testing; still unable to change the status to an already added task. Fix, test, this is urgent
```

I don't normally tell Claude that something is urgent, but it will bring the task forward to fix first.  

```plantuml
btw remove the "theme" version
```

I mention earlier that Claude gave an alternative, and, look at my very deliberate poor wording here,
and Claude understood and did what I needed, even though my prompt was ambiguous and almost meaningless
without context.

Finalising things;

```plantuml
I'd like your thoughts on current directory layout, and, we will need a docs folder too.
I need you to add the information we've gleaned to the CLAUDE.md file, and, I'd like a full course of documentation in docs (choose a suitable filename), including holistic tutorial covering installation and running.
Ensure that documentation covers running, build and an overview of the models, data and how to update.
No need to advise on this, add any further relevant information.
```

Claude is excellent at documentation and I give free-reign here to be creative. 
This is evident in the `docs` folder.

I then finish up with the following;
```
One quick fix; current to do tash do not display the priority, ergo, there's no current way to change that, which may be a requirement. Also, thinkhard on a small table structure underneath that contains completed/deleted/archived tasks. Make this collapsible.
```

Once tasks are complete, make sure we have evidence of them. I did have this in the initial prompt and
opted to remove and throw in later.  
Claude is great at building, and, sometimes a feature is better added later. Add the layers when 
appropriate.

A couple of things not quite perfect, so;
```plantuml
Amending the priority is not working; looks like a JS trigger isn't firing. Assess, fix, test, inform.
```

Again, a short, prompt, fix and let me know. There's little need to embellish here.  Claude realises 
that testing wasn't perfect and goes back.

I've found that much of my time is better invested in the initial prompts and dwelling on instructions 
for testing correctly is time well spent.

```plantuml
btw, ensure we have a method to archive
```

```plantuml
Please assess the documentation, provide a synopsis, use an agent if necessary.
```

Claude self-assess and finds it needs to make updates and corrections. 
Now, really, I should have an agent to do this automatically, and for larger projects, I do!

It's always worthwhile having Claude check it's own work and make advisories.

```plantuml
yes, apply those corrections
```

```plantuml
commit this
```

I generally commit by hand and check everything before. That's what I'm used to.

---

## Conclusion

The initial prompt is lengthy and promotes much think-time. This is a good thing.  
While an AI is thinking and you're grabbing a coffee, you're thinking too.

- Initial is key to a solid start 
- More information is better
- Allow the AI to self-audit and question itself
- Allow agents to research alternatives

The repository with all of this, is here: https://github.com/pinpointzero73/test-claude-todo
It's presently public for you to see.

I hope this has provided you with an insight to how I work using the Augmented Coding Strategy.

If you do find this interesting, I'd love a talk.
One final thing; I have two sites currently live built with this method.

https://dcbw-it.co.uk/
https://dommajs.org/

My personal page, built on DommaJS' SPA strategy is here;
https://www.dcbw-it.co.uk/index.html#/darryl

Thanks for your time. :)

